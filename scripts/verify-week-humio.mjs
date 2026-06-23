#!/usr/bin/env node
/**
 * Verify Humio error-first reliability for a specific report week.
 * Usage: node scripts/verify-week-humio.mjs [year] [week]
 */

import { config } from "dotenv"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { startOfWeek, endOfWeek, addWeeks } from "date-fns"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

const HUMIO_MIN_POLLS_BEFORE_EMPTY = 3
const HUMIO_MAX_POLL_ATTEMPTS = 60
const HUMIO_STABLE_POLLS_REQUIRED = 2
const HUMIO_GROUPBY_POLL_LIMIT = 500

const BACKEND_SCOPE = "customer=kitchenwarehouse project=kwh"
const ALL_HOOKS = "hook=/^action-/"
const HTTP_ERROR = "context.outgoingRequest.statusCode>=400"

const QUERIES = {
  totalRequests: `${BACKEND_SCOPE} ${ALL_HOOKS} | count()`,
  errorBreakdown: `${BACKEND_SCOPE} ${HTTP_ERROR} | groupBy(hook, context.outgoingRequest.statusCode, function=[count()], limit=500)`,
}

function getWeekDateRangeISO(year, week) {
  const feb2 = new Date(year, 1, 2)
  const startOfFirstWeek = startOfWeek(feb2, { weekStartsOn: 1 })
  const weekStart = addWeeks(startOfFirstWeek, week - 1)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const endInclusive = new Date(weekEnd)
  endInclusive.setHours(23, 59, 59, 999)
  return { startISO: weekStart.toISOString(), endISO: endInclusive.toISOString() }
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

function hasParseableCount(events, metaData) {
  for (const event of events) {
    for (const key of ["_count", "count", "#count"]) {
      const v = event[key]
      if (typeof v === "number" && Number.isFinite(v)) return true
      if (typeof v === "string" && Number.isFinite(Number.parseInt(v, 10))) return true
    }
  }
  if (metaData?.eventCount !== undefined && Number.isFinite(metaData.eventCount)) return true
  return events.length > 0
}

function parseCount(events, metaData) {
  for (const event of events) {
    for (const key of ["_count", "count", "#count"]) {
      const v = event[key]
      if (typeof v === "number" && Number.isFinite(v)) return v
      if (typeof v === "string") {
        const p = Number.parseInt(v, 10)
        if (Number.isFinite(p)) return p
      }
    }
  }
  if (metaData?.eventCount !== undefined && Number.isFinite(metaData.eventCount)) {
    return metaData.eventCount
  }
  return events.length
}

function rowCount(event) {
  const v = event._count ?? event.count ?? event["#count"]
  if (typeof v === "number") return v
  if (typeof v === "string") return Number.parseInt(v, 10) || 1
  return 1
}

function pollDelayMs(attempt, pollAfter) {
  if (pollAfter !== undefined && pollAfter > 0) return Math.min(pollAfter, 2000)
  if (attempt === 0) return 300
  if (attempt === 1) return 500
  if (attempt === 2) return 1000
  return 1500
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

function isJobComplete(pollData, stablePolls) {
  if (pollData.running === false) return true
  return isWorkComplete(pollData.metaData) && stablePolls >= HUMIO_STABLE_POLLS_REQUIRED - 1
}

async function pollHumioQuery(queryString, startMs, endMs, limit = 10000) {
  const token = process.env.HUMIO_API_TOKEN
  const repository = process.env.HUMIO_REPOSITORY ?? "kitchenwarehouse_view"
  const baseUrl = process.env.HUMIO_BASE_URL ?? "https://cloud.humio.com"
  const mergedQuery = mergeHumioQuery(queryString)
  const isAggregateQuery = queryString.includes("|")

  const createRes = await fetch(`${baseUrl}/api/v1/repositories/${repository}/queryjobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ queryString: mergedQuery, start: startMs, end: endMs, isLive: false }),
  })

  if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`)
  const { id: jobId } = await createRes.json()

  let stablePolls = 0
  let lastSignature = null
  let nextDelayMs = 0

  for (let attempt = 0; attempt < HUMIO_MAX_POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, nextDelayMs))

    const pollRes = await fetch(
      `${baseUrl}/api/v1/repositories/${repository}/queryjobs/${jobId}?paginationLimit=${limit}&paginationOffset=0`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!pollRes.ok) throw new Error(`Poll failed: ${pollRes.status}`)

    const pollData = await pollRes.json()
    const events = pollData.events ?? []
    nextDelayMs = pollDelayMs(attempt, pollData.metaData?.pollAfter)

    const signature = resultSignature(events)
    if (signature === lastSignature) stablePolls += 1
    else {
      stablePolls = 0
      lastSignature = signature
    }

    if (isJobComplete(pollData, stablePolls)) {
      const emptyAggregate =
        isAggregateQuery &&
        events.length === 0 &&
        !hasParseableCount(events, pollData.metaData)
      if (emptyAggregate && attempt + 1 < HUMIO_MIN_POLLS_BEFORE_EMPTY) continue
      return { events, metaData: pollData.metaData }
    }
  }

  throw new Error("Timed out")
}

async function main() {
  const year = Number.parseInt(process.argv[2] ?? "2026", 10)
  const week = Number.parseInt(process.argv[3] ?? "20", 10)
  const { startISO, endISO } = getWeekDateRangeISO(year, week)
  const startMs = new Date(startISO).getTime()
  const endMs = new Date(endISO).getTime()

  console.log(`Week ${year} w${week}: ${startISO} → ${endISO}\n`)

  const started = Date.now()

  const totalResult = await pollHumioQuery(QUERIES.totalRequests, startMs, endMs, 5)
  const totalRequests = parseCount(totalResult.events, totalResult.metaData)

  const errorResult = await pollHumioQuery(
    QUERIES.errorBreakdown,
    startMs,
    endMs,
    HUMIO_GROUPBY_POLL_LIMIT
  )
  const errorRows = errorResult.events
  const failedSum = errorRows.reduce((sum, row) => sum + rowCount(row), 0)
  const top5 = [...errorRows]
    .sort((a, b) => rowCount(b) - rowCount(a))
    .slice(0, 5)

  console.log(`totalRequests (wildcard hooks): ${totalRequests}`)
  console.log(`failed_requests (sum errorBreakdown): ${failedSum}`)
  console.log(`errorBreakdown rows: ${errorRows.length}`)
  console.log(
    `top 5: ${top5.map((e) => `${e.hook}:${e["context.outgoingRequest.statusCode"]}=${rowCount(e)}`).join(", ") || "(none)"}`
  )
  console.log(
    `error_rate: ${totalRequests > 0 ? ((failedSum / totalRequests) * 100).toFixed(4) : 0}%`
  )
  console.log(`duration: ${Date.now() - started}ms\n`)

  if (totalRequests === 0 || failedSum === 0 || top5.length === 0) {
    console.error("FAIL: expected non-zero total, failed sum, and top hooks")
    process.exit(1)
  }

  if (errorRows.length >= 500) {
    console.warn("WARN: errorBreakdown hit limit=500 — totals may be truncated")
  }

  console.log("PASS: error-first System Health counts look sane")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
