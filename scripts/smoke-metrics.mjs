#!/usr/bin/env node

import { config } from "dotenv"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

const now = Date.now()
const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
const startISO = new Date(sevenDaysAgo).toISOString()
const endISO = new Date(now).toISOString()

function rumBaseQuery() {
  return process.env.DATADOG_RUM_QUERY ?? "@type:view env:prod"
}

function humioEnvFilter() {
  return process.env.HUMIO_ENVIRONMENT_FILTER ?? "environment = production"
}

function mergeHumioQuery(query) {
  const filter = humioEnvFilter()
  const trimmed = query.trim()
  if (!filter) return trimmed

  const pipeIndex = trimmed.indexOf("|")
  if (pipeIndex !== -1) {
    const filterPart = trimmed.slice(0, pipeIndex).trim()
    const aggregatePart = trimmed.slice(pipeIndex).trim()
    return `${filter} AND ${filterPart} ${aggregatePart}`
  }

  return `${filter} AND (${trimmed})`
}

async function datadogFetch(path, body) {
  const apiKey = process.env.DATADOG_API_KEY
  const appKey = process.env.DATADOG_APPLICATION_KEY
  const baseUrl = process.env.DATADOG_BASE_URL ?? "https://ap1.datadoghq.com"

  if (!apiKey || !appKey) {
    throw new Error("Missing DATADOG_API_KEY or DATADOG_APPLICATION_KEY")
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "DD-API-KEY": apiKey,
      "DD-APPLICATION-KEY": appKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Datadog ${path} failed: ${res.status} ${text.slice(0, 200)}`)
  }

  return res.json()
}

async function rumAggregate(query, compute, groupBy) {
  return datadogFetch("/api/v2/rum/analytics/aggregate", {
    compute,
    filter: { from: startISO, to: endISO, query },
    ...(groupBy ? { group_by: groupBy } : {}),
  })
}

const HUMIO_MIN_POLLS_BEFORE_EMPTY = 3
const HUMIO_MAX_POLL_ATTEMPTS = 60
const HUMIO_STABLE_POLLS_REQUIRED = 2

function hasParseableCount(events, metaData) {
  for (const event of events) {
    for (const key of ["_count", "count", "#count"]) {
      const value = event[key]
      if (typeof value === "number" && Number.isFinite(value)) return true
      if (typeof value === "string" && Number.isFinite(Number.parseInt(value, 10))) return true
    }
  }
  if (metaData?.eventCount !== undefined && Number.isFinite(metaData.eventCount)) return true
  return events.length > 0
}

function isWorkComplete(metaData) {
  const totalWork = metaData?.totalWork
  const workDone = metaData?.workDone
  return (
    totalWork !== undefined &&
    workDone !== undefined &&
    totalWork > 0 &&
    workDone >= totalWork
  )
}

function resultSignature(events) {
  if (events.length === 0) return "empty"
  return JSON.stringify(
    events.map((event) => [
      event.hook ?? event["hook"],
      event["context.outgoingRequest.statusCode"],
      event._count ?? event.count ?? event["#count"],
    ])
  )
}

function pollDelayMs(attempt, pollAfter) {
  if (pollAfter !== undefined && pollAfter > 0) return Math.min(pollAfter, 2000)
  if (attempt === 0) return 300
  if (attempt === 1) return 500
  if (attempt === 2) return 1000
  return 1500
}

async function runHumioQuery(queryString) {
  const token = process.env.HUMIO_API_TOKEN
  const repository = process.env.HUMIO_REPOSITORY ?? "kitchenwarehouse_view"
  const baseUrl = process.env.HUMIO_BASE_URL ?? "https://cloud.humio.com"

  if (!token) {
    throw new Error("Missing HUMIO_API_TOKEN")
  }

  const mergedQuery = mergeHumioQuery(queryString)

  const createRes = await fetch(`${baseUrl}/api/v1/repositories/${repository}/queryjobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queryString: mergedQuery,
      start: sevenDaysAgo,
      end: now,
      isLive: false,
    }),
  })

  if (!createRes.ok) {
    const body = await createRes.text()
    throw new Error(`Humio create failed: ${createRes.status} ${body.slice(0, 200)}`)
  }

  const { id: jobId } = await createRes.json()

  let stablePolls = 0
  let lastSignature = null
  let nextDelayMs = 0
  const isAggregateQuery = queryString.includes("|")

  for (let attempt = 0; attempt < HUMIO_MAX_POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, nextDelayMs))
    }

    const pollRes = await fetch(
      `${baseUrl}/api/v1/repositories/${repository}/queryjobs/${jobId}?paginationLimit=100&paginationOffset=0`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!pollRes.ok) {
      const body = await pollRes.text()
      throw new Error(`Humio poll failed: ${pollRes.status} ${body.slice(0, 200)}`)
    }

    const pollData = await pollRes.json()
    const events = pollData.events ?? []
    nextDelayMs = pollDelayMs(attempt, pollData.metaData?.pollAfter)

    const signature = resultSignature(events)
    if (signature === lastSignature) stablePolls += 1
    else {
      stablePolls = 0
      lastSignature = signature
    }

    const workComplete = isWorkComplete(pollData.metaData)
    const explicitlyComplete = pollData.running === false
    const stableWorkComplete =
      workComplete && stablePolls >= HUMIO_STABLE_POLLS_REQUIRED - 1

    if (explicitlyComplete || stableWorkComplete) {
      const emptyAggregate =
        isAggregateQuery &&
        events.length === 0 &&
        !hasParseableCount(events, pollData.metaData)
      if (emptyAggregate && attempt + 1 < HUMIO_MIN_POLLS_BEFORE_EMPTY) continue
      return { events, mergedQuery }
    }
  }

  throw new Error(`Humio query timed out: ${mergedQuery}`)
}

function pass(label, ok, detail) {
  const status = ok ? "PASS" : "FAIL"
  console.log(`${status} ${label}${detail ? `: ${detail}` : ""}`)
  return ok
}

async function main() {
  console.log(`Smoke test window: ${startISO} → ${endISO}\n`)

  let allPassed = true
  const baseQuery = rumBaseQuery()

  try {
    const traffic = await rumAggregate(baseQuery, [{ aggregation: "count", type: "total" }])
    const totalViews = traffic.data?.buckets?.[0]?.computes?.c0 ?? 0
    allPassed = pass("Datadog traffic", totalViews > 0, `${totalViews} views`) && allPassed
  } catch (error) {
    allPassed = pass("Datadog traffic", false, error.message) && allPassed
  }

  for (const device of ["Mobile", "Desktop"]) {
    try {
      const query = `${baseQuery} @device.type:${device}`
      const vitals = await rumAggregate(query, [
        { aggregation: "pc75", metric: "@view.largest_contentful_paint", type: "total" },
      ])
      const lcpNs = vitals.data?.buckets?.[0]?.computes?.c0 ?? 0
      const lcpSec = lcpNs / 1_000_000_000
      allPassed =
        pass(`Datadog LCP (${device})`, lcpNs > 0, `${lcpSec.toFixed(2)}s`) && allPassed
    } catch (error) {
      allPassed = pass(`Datadog LCP (${device})`, false, error.message) && allPassed
    }
  }

  const BACKEND_SCOPE = "customer=kitchenwarehouse project=kwh"
  const ALL_HOOKS = "hook=/^action-/"
  const HTTP_ERROR = "context.outgoingRequest.statusCode>=400"

  const humioQueries = {
    totalRequests: `${BACKEND_SCOPE} ${ALL_HOOKS} | count()`,
    errorBreakdown: `${BACKEND_SCOPE} ${HTTP_ERROR} | groupBy(hook, context.outgoingRequest.statusCode, function=[count()], limit=500)`,
  }

  for (const [name, query] of Object.entries(humioQueries)) {
    try {
      const { events, mergedQuery } = await runHumioQuery(query)
      const countField = events[0]?._count ?? events[0]?.count ?? events[0]?.["#count"]
      const failedSum =
        name === "errorBreakdown"
          ? events.reduce((sum, e) => sum + Number(e._count ?? e.count ?? 1), 0)
          : 0
      const detail =
        name === "errorBreakdown"
          ? `rows=${events.length} failedSum=${failedSum} top=${events
              .slice(0, 3)
              .map(
                (e) =>
                  `${e.hook ?? "?"}:${e["context.outgoingRequest.statusCode"] ?? "?"}=${e._count ?? e.count ?? 1}`
              )
              .join(", ")}`
          : countField !== undefined
            ? `count=${countField}`
            : `${events.length} events`
      let ok = true
      if (name === "totalRequests") {
        ok = Number(countField ?? 0) > 0
      }
      if (name === "errorBreakdown") {
        ok = events.length > 0 && failedSum > 0
      }
      allPassed =
        pass(`Humio ${name}`, ok, `${detail} (${mergedQuery.slice(0, 90)}...)`) &&
        allPassed
    } catch (error) {
      const message =
        error instanceof Error && "cause" in error && error.cause instanceof Error
          ? `${error.message} (${error.cause.message})`
          : error instanceof Error
            ? error.message
            : String(error)
      allPassed = pass(`Humio ${name}`, false, message) && allPassed
    }
  }

  const redisHost = process.env.REDIS_HOST
  const redisPassword = process.env.REDIS_PASSWORD
  allPassed =
    pass("Redis env", Boolean(redisHost && redisPassword), redisHost ? "configured" : "missing") &&
    allPassed

  console.log("")
  if (allPassed) {
    console.log("All smoke checks passed.")
    process.exit(0)
  }

  console.error("Some smoke checks failed.")
  process.exit(1)
}

main().catch((error) => {
  console.error("Smoke test crashed:", error.message)
  process.exit(1)
})
