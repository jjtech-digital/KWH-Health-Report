import "server-only"

import { runInBatches } from "@/lib/metrics/commercetools/run-in-batches"
import type { HumioEvent } from "./client"
import {
  HUMIO_BATCH_GAP_MS,
  HUMIO_BATCH_SIZE,
  HUMIO_SLICE_HOURS,
  HUMIO_SLICE_HOURS_COUNT,
} from "./constants"
import { splitRangeIntoSlices } from "./intervals"
import {
  breakdownSliceWithRetry,
  countSliceWithRetry,
  logSliceSummary,
  type SliceRunStats,
} from "./resilient-slice"

export interface SlicedQueryResult {
  value: number | HumioEvent[]
  stats: SliceRunStats
}

export async function sumSlicedCount(
  queryString: string,
  startMs: number,
  endMs: number,
  label: string,
  sliceHours = HUMIO_SLICE_HOURS_COUNT
): Promise<SlicedQueryResult> {
  const slices = splitRangeIntoSlices(startMs, endMs, sliceHours)
  const stats: SliceRunStats = { succeeded: 0, failed: 0, total: slices.length }

  if (slices.length === 0) {
    return { value: 0, stats }
  }

  const counts: number[] = []
  const failedIndices: number[] = []

  await runInBatches(
    slices,
    async (slice, index) => {
      try {
        const count = await countSliceWithRetry(
          queryString,
          slice.startMs,
          slice.endMs,
          label,
          stats
        )
        counts[index] = count
      } catch {
        failedIndices.push(index)
        counts[index] = 0
      }
    },
    { batchSize: HUMIO_BATCH_SIZE, gapMs: HUMIO_BATCH_GAP_MS }
  )

  logSliceSummary(`${label} count`, stats, sliceHours, { failedIndices: failedIndices.length })

  return {
    value: counts.reduce((sum, count) => sum + count, 0),
    stats,
  }
}

export async function mergeSlicedErrorBreakdown(
  queryString: string,
  startMs: number,
  endMs: number,
  sliceHours = HUMIO_SLICE_HOURS
): Promise<SlicedQueryResult> {
  const slices = splitRangeIntoSlices(startMs, endMs, sliceHours)
  const stats: SliceRunStats = { succeeded: 0, failed: 0, total: slices.length }

  if (slices.length === 0) {
    return { value: [], stats }
  }

  const sliceRows: HumioEvent[][] = []
  const failedIndices: number[] = []

  await runInBatches(
    slices,
    async (slice, index) => {
      try {
        sliceRows[index] = await breakdownSliceWithRetry(
          queryString,
          slice.startMs,
          slice.endMs,
          stats
        )
      } catch {
        failedIndices.push(index)
        sliceRows[index] = []
      }
    },
    { batchSize: HUMIO_BATCH_SIZE, gapMs: HUMIO_BATCH_GAP_MS }
  )

  logSliceSummary("errorBreakdown", stats, sliceHours, { failedIndices: failedIndices.length })

  const merged = mergeAllGroupByRows(sliceRows.flat())
  return { value: merged, stats }
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

function mergeAllGroupByRows(rows: HumioEvent[]): HumioEvent[] {
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

function sliceFailureRatio(stats: SliceRunStats): number {
  if (stats.total === 0) return 0
  return stats.failed / stats.total
}

export function isSliceFailureAcceptable(stats: SliceRunStats): boolean {
  return sliceFailureRatio(stats) <= 0.2
}

export { sliceFailureRatio }
