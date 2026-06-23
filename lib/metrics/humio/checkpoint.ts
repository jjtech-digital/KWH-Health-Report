import "server-only"

import type { HumioMetrics } from "@/lib/types/metrics"
import type { HumioCheckpoint } from "@/lib/types/provider-cache"
import { emptyReliability } from "@/lib/types/health-report"
import { METRICS_HUMIO_TIMEOUT_MS } from "@/lib/config/metrics-timeouts"
import {
  HUMIO_GROUPBY_POLL_LIMIT,
  HUMIO_SLICE_FAILURE_THRESHOLD,
  HUMIO_SLICE_HOURS,
  HUMIO_SLICE_HOURS_COUNT,
} from "./constants"
import { HUMIO_QUERIES } from "./queries"
import { parseReliabilityFromEvents } from "./parse-reliability"
import { parsePaymentFailures } from "./parse-payments"
import type { HumioEvent } from "./client"
import { runHumioEventCount, runHumioQueryWithLogging } from "./client"
import { splitRangeIntoSlices } from "./intervals"
import {
  breakdownSliceWithRetry,
  countSliceWithRetry,
  type SliceRunStats,
} from "./resilient-slice"
import { mergeAllGroupByRows } from "./run-sliced-query"

export interface HumioCheckpointProgress {
  phase: HumioCheckpoint["phase"]
  sliceIndex: number
  totalSlices: number
}

export interface HumioCheckpointResult {
  complete: boolean
  metrics?: HumioMetrics
  checkpoint: HumioCheckpoint | null
  progress?: HumioCheckpointProgress
  paused: boolean
}

function isPastDeadline(deadlineMs?: number): boolean {
  if (deadlineMs === undefined) return false
  return Date.now() >= deadlineMs
}

function sliceFailureRatio(stats: SliceRunStats): number {
  if (stats.total === 0) return 0
  return stats.failed / stats.total
}

function queryFailed(stats: SliceRunStats, hasData: boolean): boolean {
  if (sliceFailureRatio(stats) > HUMIO_SLICE_FAILURE_THRESHOLD) return true
  return !hasData && stats.failed > 0
}

function computeReliabilityFailed(
  totalRequests: number,
  totalFailed: boolean,
  breakdownFailed: boolean,
  errorBreakdownEvents: HumioEvent[]
): boolean {
  const hasBreakdown = errorBreakdownEvents.length > 0
  const hasTotal = totalRequests > 0

  if (totalFailed && breakdownFailed) return true
  if (!hasBreakdown && !hasTotal) return true
  if (hasTotal && breakdownFailed) return true
  if (hasBreakdown && totalFailed) return false

  return false
}

function freshCheckpoint(): HumioCheckpoint {
  return {
    startedAt: Date.now(),
    phase: "totalRequests",
    sliceIndex: 0,
    partialTotalRequests: 0,
    partialBreakdownEvents: [],
    totalSliceStats: { succeeded: 0, failed: 0, total: 0 },
    breakdownSliceStats: { succeeded: 0, failed: 0, total: 0 },
  }
}

function isHumioWeekExpired(checkpoint: HumioCheckpoint): boolean {
  return Date.now() - checkpoint.startedAt > METRICS_HUMIO_TIMEOUT_MS
}

async function tryFullRangeCount(startMs: number, endMs: number): Promise<number | null> {
  try {
    return await runHumioEventCount(
      "totalRequests",
      HUMIO_QUERIES.totalRequests,
      startMs,
      endMs
    )
  } catch {
    return null
  }
}

async function tryFullRangeBreakdown(
  startMs: number,
  endMs: number
): Promise<HumioEvent[] | null> {
  try {
    return await runHumioQueryWithLogging(
      "errorBreakdown",
      HUMIO_QUERIES.errorBreakdown,
      startMs,
      endMs,
      HUMIO_GROUPBY_POLL_LIMIT
    )
  } catch {
    return null
  }
}

export async function fetchHumioMetricsCheckpointed(
  startMs: number,
  endMs: number,
  existingCheckpoint: HumioCheckpoint | null,
  opts?: {
    deadlineMs?: number
    onSliceProgress?: (progress: HumioCheckpointProgress) => void
  }
): Promise<HumioCheckpointResult> {
  let checkpoint = existingCheckpoint ?? freshCheckpoint()

  if (isHumioWeekExpired(checkpoint)) {
    return { complete: false, checkpoint: null, paused: false }
  }

  const countSlices = splitRangeIntoSlices(startMs, endMs, HUMIO_SLICE_HOURS_COUNT)
  const breakdownSlices = splitRangeIntoSlices(startMs, endMs, HUMIO_SLICE_HOURS)

  opts?.onSliceProgress?.({
    phase: checkpoint.phase,
    sliceIndex: checkpoint.sliceIndex,
    totalSlices: countSlices.length,
  })

  if (checkpoint.phase === "totalRequests" && checkpoint.sliceIndex === 0) {
    const fullCount = await tryFullRangeCount(startMs, endMs)
    if (fullCount !== null && !isPastDeadline(opts?.deadlineMs)) {
      checkpoint.partialTotalRequests = fullCount
      checkpoint.totalSliceStats = { succeeded: 1, failed: 0, total: 1 }
      checkpoint.phase = "errorBreakdown"
      checkpoint.sliceIndex = 0
    }
  }

  while (checkpoint.phase === "totalRequests") {
    if (isPastDeadline(opts?.deadlineMs)) {
      return {
        complete: false,
        checkpoint,
        paused: true,
        progress: {
          phase: checkpoint.phase,
          sliceIndex: checkpoint.sliceIndex,
          totalSlices: countSlices.length,
        },
      }
    }

    if (checkpoint.sliceIndex >= countSlices.length) {
      checkpoint.phase = "errorBreakdown"
      checkpoint.sliceIndex = 0
      break
    }

    if (checkpoint.totalSliceStats.total === 0) {
      checkpoint.totalSliceStats.total = countSlices.length
    }

    const slice = countSlices[checkpoint.sliceIndex]!
    try {
      const count = await countSliceWithRetry(
        HUMIO_QUERIES.totalRequests,
        slice.startMs,
        slice.endMs,
        "totalRequests",
        checkpoint.totalSliceStats
      )
      checkpoint.partialTotalRequests += count
    } catch {
      // stats updated inside retry helper
    }

    checkpoint.sliceIndex += 1
    opts?.onSliceProgress?.({
      phase: checkpoint.phase,
      sliceIndex: checkpoint.sliceIndex,
      totalSlices: countSlices.length,
    })
  }

  if (checkpoint.phase === "errorBreakdown" && checkpoint.sliceIndex === 0) {
    const fullBreakdown = await tryFullRangeBreakdown(startMs, endMs)
    if (fullBreakdown !== null && !isPastDeadline(opts?.deadlineMs)) {
      checkpoint.partialBreakdownEvents = fullBreakdown
      checkpoint.breakdownSliceStats = { succeeded: 1, failed: 0, total: 1 }
      checkpoint.phase = "payments"
      checkpoint.sliceIndex = 0
    }
  }

  while (checkpoint.phase === "errorBreakdown") {
    if (isPastDeadline(opts?.deadlineMs)) {
      return {
        complete: false,
        checkpoint,
        paused: true,
        progress: {
          phase: checkpoint.phase,
          sliceIndex: checkpoint.sliceIndex,
          totalSlices: breakdownSlices.length,
        },
      }
    }

    if (checkpoint.sliceIndex >= breakdownSlices.length) {
      checkpoint.phase = "payments"
      checkpoint.sliceIndex = 0
      break
    }

    if (checkpoint.breakdownSliceStats.total === 0) {
      checkpoint.breakdownSliceStats.total = breakdownSlices.length
    }

    const slice = breakdownSlices[checkpoint.sliceIndex]!
    try {
      const rows = await breakdownSliceWithRetry(
        HUMIO_QUERIES.errorBreakdown,
        slice.startMs,
        slice.endMs,
        checkpoint.breakdownSliceStats
      )
      const merged = mergeAllGroupByRows([
        ...(checkpoint.partialBreakdownEvents as HumioEvent[]),
        ...rows,
      ])
      checkpoint.partialBreakdownEvents = merged
    } catch {
      // stats updated inside retry helper
    }

    checkpoint.sliceIndex += 1
    opts?.onSliceProgress?.({
      phase: checkpoint.phase,
      sliceIndex: checkpoint.sliceIndex,
      totalSlices: breakdownSlices.length,
    })
  }

  if (checkpoint.phase === "payments") {
    if (isPastDeadline(opts?.deadlineMs)) {
      return {
        complete: false,
        checkpoint,
        paused: true,
        progress: { phase: "payments", sliceIndex: 0, totalSlices: 1 },
      }
    }

    if (checkpoint.paymentsDeclined === undefined) {
      const payments = await parsePaymentFailures(startMs, endMs)
      checkpoint.paymentsDeclined = payments.declined
      checkpoint.paymentsApproved = payments.approved
    }
  }

  const errorBreakdownEvents = checkpoint.partialBreakdownEvents as HumioEvent[]
  const totalRequests = checkpoint.partialTotalRequests
  const totalFailed = queryFailed(checkpoint.totalSliceStats, totalRequests > 0)
  const breakdownFailed = queryFailed(
    checkpoint.breakdownSliceStats,
    errorBreakdownEvents.length > 0
  )

  const reliabilityFailed = computeReliabilityFailed(
    totalRequests,
    totalFailed,
    breakdownFailed,
    errorBreakdownEvents
  )

  const reliability = reliabilityFailed
    ? emptyReliability()
    : parseReliabilityFromEvents(errorBreakdownEvents, totalRequests)

  const metrics: HumioMetrics = {
    reliability,
    payment_failures_declined: checkpoint.paymentsDeclined ?? 0,
    payment_failures_approved: checkpoint.paymentsApproved ?? 0,
    reliabilityFailed,
  }

  return {
    complete: true,
    metrics,
    checkpoint: null,
    paused: false,
  }
}
