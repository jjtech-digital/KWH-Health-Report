import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  HUMIO_COUNT_POLL_LIMIT,
  HUMIO_MAX_POLL_ATTEMPTS,
  HUMIO_MIN_POLLS_BEFORE_EMPTY,
  HUMIO_STABLE_POLLS_REQUIRED,
} from "./constants"
import { hasParseableHumioCount, parseHumioCount } from "./parse-count"
import { withHumioQuerySlot } from "./query-semaphore"

interface HumioEnv {
  token: string
  repository: string
  baseUrl: string
  environmentFilter: string
}

export interface HumioEvent {
  [key: string]: unknown
}

export interface HumioQueryPollResult {
  events: HumioEvent[]
  metaData?: {
    eventCount?: number
    workDone?: number
    totalWork?: number
    pollAfter?: number
  }
  pollAttempts: number
}

function getHumioEnv(): HumioEnv {
  const token = process.env.HUMIO_API_TOKEN
  const repository = process.env.HUMIO_REPOSITORY ?? "kitchenwarehouse_view"
  const baseUrl = process.env.HUMIO_BASE_URL ?? "https://cloud.humio.com"
  const environmentFilter =
    process.env.HUMIO_ENVIRONMENT_FILTER ?? "environment = production"

  if (!token) {
    throw new Error("Missing HUMIO_API_TOKEN")
  }

  return { token, repository, baseUrl, environmentFilter }
}

export function mergeHumioQuery(query: string, environmentFilter: string): string {
  const trimmed = query.trim()
  if (!environmentFilter) return trimmed

  const pipeIndex = trimmed.indexOf("|")
  if (pipeIndex !== -1) {
    const filterPart = trimmed.slice(0, pipeIndex).trim()
    const aggregatePart = trimmed.slice(pipeIndex).trim()
    return `${environmentFilter} AND ${filterPart} ${aggregatePart}`
  }

  return `${environmentFilter} AND (${trimmed})`
}

export function buildHumioQuery(queryString: string): string {
  const { environmentFilter } = getHumioEnv()
  return mergeHumioQuery(queryString, environmentFilter)
}

function isHumioJobComplete(pollData: { running?: boolean }): boolean {
  return pollData.running === false
}

function isHumioWorkComplete(metaData?: {
  workDone?: number
  totalWork?: number
}): boolean {
  const totalWork = metaData?.totalWork
  const workDone = metaData?.workDone
  return (
    totalWork !== undefined &&
    workDone !== undefined &&
    totalWork > 0 &&
    workDone >= totalWork
  )
}

function resultSignature(events: HumioEvent[]): string {
  if (events.length === 0) return "empty"
  return JSON.stringify(
    events.map((event) => {
      const hook = event.hook ?? event["hook"]
      const status =
        event["context.outgoingRequest.statusCode"] ??
        event.extension_status_code ??
        event["incomingRequest.statusCode"]
      const count = event._count ?? event.count ?? event["#count"]
      return [hook, status, count]
    })
  )
}

function pollDelayMs(attempt: number, pollAfter?: number): number {
  if (pollAfter !== undefined && pollAfter > 0) {
    return Math.min(pollAfter, 2000)
  }
  if (attempt === 0) return 300
  if (attempt === 1) return 500
  if (attempt === 2) return 1000
  return 1500
}

function isEmptyCompletedResult(
  pollData: HumioQueryPollResult,
  isAggregateQuery: boolean
): boolean {
  if (pollData.events.length > 0) return false
  if (hasParseableHumioCount(pollData.events, pollData.metaData)) return false
  if (!isAggregateQuery) return true
  return pollData.pollAttempts < HUMIO_MIN_POLLS_BEFORE_EMPTY
}

async function createHumioJob(
  mergedQuery: string,
  startMs: number,
  endMs: number,
  env: HumioEnv
): Promise<string> {
  const createRes = await fetch(
    `${env.baseUrl}/api/v1/repositories/${env.repository}/queryjobs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queryString: mergedQuery,
        start: startMs,
        end: endMs,
        isLive: false,
      }),
    }
  )

  if (!createRes.ok) {
    const body = await createRes.text()
    throw new Error(`Humio query job creation failed: ${createRes.status} ${body}`)
  }

  const { id: jobId } = (await createRes.json()) as { id: string }
  return jobId
}

async function pollHumioQueryInner(
  queryString: string,
  startMs: number,
  endMs: number,
  limit: number
): Promise<HumioQueryPollResult> {
  const env = getHumioEnv()
  const mergedQuery = mergeHumioQuery(queryString, env.environmentFilter)
  const isAggregateQuery = queryString.includes("|")

  let jobId = await createHumioJob(mergedQuery, startMs, endMs, env)
  let jobRecreates = 0

  let stablePolls = 0
  let lastSignature: string | null = null
  let nextDelayMs = 0

  for (let attempt = 0; attempt < HUMIO_MAX_POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, nextDelayMs))
    }

    const pollRes = await fetch(
      `${env.baseUrl}/api/v1/repositories/${env.repository}/queryjobs/${jobId}?paginationLimit=${limit}&paginationOffset=0`,
      {
        headers: { Authorization: `Bearer ${env.token}` },
      }
    )

    if (!pollRes.ok) {
      const body = await pollRes.text()
      if (pollRes.status === 404 && jobRecreates < 1) {
        jobRecreates += 1
        metricsLog.warn("humio", "Query job evicted — recreating", {
          query: queryString,
          jobId,
          pollAttempt: attempt + 1,
        })
        jobId = await createHumioJob(mergedQuery, startMs, endMs, env)
        stablePolls = 0
        lastSignature = null
        continue
      }
      throw new Error(`Humio query poll failed: ${pollRes.status} ${body}`)
    }

    const pollData = (await pollRes.json()) as {
      running?: boolean
      events?: HumioEvent[]
      metaData?: {
        eventCount?: number
        workDone?: number
        totalWork?: number
        pollAfter?: number
      }
    }

    const result: HumioQueryPollResult = {
      events: pollData.events ?? [],
      metaData: pollData.metaData,
      pollAttempts: attempt + 1,
    }

    nextDelayMs = pollDelayMs(attempt, result.metaData?.pollAfter)

    const signature = resultSignature(result.events)
    if (signature === lastSignature) {
      stablePolls += 1
    } else {
      stablePolls = 0
      lastSignature = signature
    }

    const workComplete = isHumioWorkComplete(result.metaData)
    const explicitlyComplete = isHumioJobComplete(pollData)
    const stableWorkComplete =
      workComplete && stablePolls >= HUMIO_STABLE_POLLS_REQUIRED - 1

    if (explicitlyComplete || stableWorkComplete) {
      if (isEmptyCompletedResult(result, isAggregateQuery)) {
        continue
      }

      if (
        isAggregateQuery &&
        result.events.length === 0 &&
        !hasParseableHumioCount(result.events, result.metaData)
      ) {
        metricsLog.warn("humio", "Query completed with empty aggregate result", {
          query: queryString,
          mergedQuery,
          pollAttempts: result.pollAttempts,
          metaData: result.metaData,
          workComplete,
          explicitlyComplete,
        })
      }

      return result
    }
  }

  throw new Error(`Humio query timed out for: ${mergedQuery}`)
}

async function pollHumioQuery(
  queryString: string,
  startMs: number,
  endMs: number,
  limit = 10000
): Promise<HumioQueryPollResult> {
  return withHumioQuerySlot(() =>
    pollHumioQueryInner(queryString, startMs, endMs, limit)
  )
}

interface HumioQueryOptions {
  suppressErrorLog?: boolean
}

export async function runHumioQuery(
  queryString: string,
  startMs: number,
  endMs: number,
  limit = 10000,
  options?: HumioQueryOptions
): Promise<HumioEvent[]> {
  try {
    const result = await pollHumioQuery(queryString, startMs, endMs, limit)
    return result.events
  } catch (error) {
    if (!options?.suppressErrorLog) {
      metricsLog.error("humio", "Query failed", error, { query: queryString })
    }
    throw error
  }
}

export async function runHumioEventCount(
  name: string,
  queryString: string,
  startMs: number,
  endMs: number,
  options?: HumioQueryOptions
): Promise<number> {
  try {
    const result = await pollHumioQuery(
      queryString,
      startMs,
      endMs,
      HUMIO_COUNT_POLL_LIMIT
    )
    return parseHumioCount(result.events, result.metaData, {
      preferAggregateFields: queryString.includes("|"),
    })
  } catch (error) {
    if (!options?.suppressErrorLog) {
      metricsLog.error("humio", "Event count query failed", error, {
        name,
        query: queryString,
      })
    }
    throw error
  }
}

export async function runHumioCount(
  name: string,
  queryString: string,
  startMs: number,
  endMs: number
): Promise<number> {
  return runHumioEventCount(name, queryString, startMs, endMs)
}

export async function countHumioEvents(
  queryString: string,
  startMs: number,
  endMs: number
): Promise<number> {
  return runHumioEventCount("countHumioEvents", queryString, startMs, endMs)
}

export async function runHumioQueryWithLogging(
  name: string,
  queryString: string,
  startMs: number,
  endMs: number,
  limit = 10000
): Promise<HumioEvent[]> {
  try {
    return await runHumioQuery(queryString, startMs, endMs, limit)
  } catch (error) {
    metricsLog.error("humio", "Query failed", error, {
      name,
      query: queryString,
    })
    throw error
  }
}
