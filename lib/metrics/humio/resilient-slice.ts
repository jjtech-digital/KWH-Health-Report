import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import type { HumioEvent } from "./client"
import { runHumioEventCount, runHumioQuery } from "./client"
import {
  HUMIO_GROUPBY_POLL_LIMIT,
  HUMIO_MIN_SLICE_MS,
} from "./constants"

export interface SliceRunStats {
  succeeded: number
  failed: number
  total: number
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes("timed out")
}

export async function countSliceWithRetry(
  queryString: string,
  startMs: number,
  endMs: number,
  label: string,
  stats: SliceRunStats
): Promise<number> {
  try {
    const count = await runHumioEventCount(label, queryString, startMs, endMs, {
      suppressErrorLog: true,
    })
    stats.succeeded += 1
    return count
  } catch (error) {
    const rangeMs = endMs - startMs
    if (!isTimeoutError(error) || rangeMs <= HUMIO_MIN_SLICE_MS) {
      stats.failed += 1
      throw error
    }

    const mid = startMs + Math.floor(rangeMs / 2)
    stats.total += 1

    const [first, second] = await Promise.all([
      countSliceWithRetry(queryString, startMs, mid, label, stats),
      countSliceWithRetry(queryString, mid, endMs, label, stats),
    ])

    return first + second
  }
}

const COUNT_FIELD_KEYS = ["_count", "count", "#count"] as const

function readRowCount(event: HumioEvent): number {
  for (const key of COUNT_FIELD_KEYS) {
    const value = event[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 1
}

function rowKey(event: HumioEvent): string | null {
  const hook = event.hook ?? event["hook"]
  const status =
    event["context.outgoingRequest.statusCode"] ??
    event.extension_status_code ??
    event["incomingRequest.statusCode"]

  if (typeof hook !== "string" || hook.length === 0) return null
  if (status === undefined || status === null) return null

  return `${hook}:${status}`
}

function mergeGroupByRows(rows: HumioEvent[]): HumioEvent[] {
  const merged = new Map<string, HumioEvent>()

  for (const row of rows) {
    const key = rowKey(row)
    if (!key) continue

    const existing = merged.get(key)
    if (existing) {
      existing._count = readRowCount(existing) + readRowCount(row)
      continue
    }

    merged.set(key, { ...row, _count: readRowCount(row) })
  }

  return [...merged.values()]
}

export async function breakdownSliceWithRetry(
  queryString: string,
  startMs: number,
  endMs: number,
  stats: SliceRunStats
): Promise<HumioEvent[]> {
  try {
    const rows = await runHumioQuery(queryString, startMs, endMs, HUMIO_GROUPBY_POLL_LIMIT, {
      suppressErrorLog: true,
    })
    stats.succeeded += 1
    return rows
  } catch (error) {
    const rangeMs = endMs - startMs
    if (!isTimeoutError(error) || rangeMs <= HUMIO_MIN_SLICE_MS) {
      stats.failed += 1
      throw error
    }

    const mid = startMs + Math.floor(rangeMs / 2)
    stats.total += 1

    const [first, second] = await Promise.all([
      breakdownSliceWithRetry(queryString, startMs, mid, stats),
      breakdownSliceWithRetry(queryString, mid, endMs, stats),
    ])

    return mergeGroupByRows([...first, ...second])
  }
}

export function logSliceSummary(
  operation: string,
  stats: SliceRunStats,
  sliceHours: number,
  extra?: Record<string, unknown>
): void {
  if (stats.failed === 0) return

  metricsLog.warn("humio", `${operation} slice summary`, {
    slicesOk: stats.succeeded,
    slicesFailed: stats.failed,
    slicesTotal: stats.total,
    sliceHours,
    ...extra,
  })
}
