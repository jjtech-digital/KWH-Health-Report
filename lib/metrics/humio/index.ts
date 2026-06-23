import "server-only"

import type { HumioMetrics } from "@/lib/types/metrics"
import { emptyReliability } from "@/lib/types/health-report"
import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  buildHumioQuery,
  runHumioEventCount,
  runHumioQueryWithLogging,
} from "./client"
import {
  HUMIO_FULL_RANGE_MAX_MS,
  HUMIO_GROUPBY_POLL_LIMIT,
  HUMIO_SLICE_FAILURE_THRESHOLD,
} from "./constants"
import { HUMIO_QUERIES } from "./queries"
import { parseReliabilityFromEvents } from "./parse-reliability"
import { parsePaymentFailures } from "./parse-payments"
import {
  mergeSlicedErrorBreakdown,
  sumSlicedCount,
} from "./run-sliced-query"
import type { SliceRunStats } from "./resilient-slice"

function toEpochRange(startISO: string, endISO: string) {
  return {
    startMs: new Date(startISO).getTime(),
    endMs: new Date(endISO).getTime(),
  }
}

function shouldUseSlices(startMs: number, endMs: number): boolean {
  return endMs - startMs > HUMIO_FULL_RANGE_MAX_MS
}

function sliceFailureRatio(stats: SliceRunStats): number {
  if (stats.total === 0) return 0
  return stats.failed / stats.total
}

function queryFailed(stats: SliceRunStats, hasData: boolean): boolean {
  if (sliceFailureRatio(stats) > HUMIO_SLICE_FAILURE_THRESHOLD) return true
  return !hasData && stats.failed > 0
}

async function fetchTotalRequests(
  startMs: number,
  endMs: number
): Promise<{ total: number; stats: SliceRunStats; failed: boolean }> {
  const emptyStats: SliceRunStats = { succeeded: 0, failed: 0, total: 0 }

  if (!shouldUseSlices(startMs, endMs)) {
    try {
      const total = await runHumioEventCount(
        "totalRequests",
        HUMIO_QUERIES.totalRequests,
        startMs,
        endMs
      )
      return { total, stats: { succeeded: 1, failed: 0, total: 1 }, failed: false }
    } catch (error) {
      metricsLog.warn("humio", "Full-range totalRequests failed — trying slices", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    const { value, stats } = await sumSlicedCount(
      HUMIO_QUERIES.totalRequests,
      startMs,
      endMs,
      "totalRequests"
    )
    const total = value as number
    return { total, stats, failed: queryFailed(stats, total > 0) }
  } catch (error) {
    metricsLog.warn("humio", "Total requests slice fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { total: 0, stats: emptyStats, failed: true }
  }
}

async function fetchErrorBreakdown(
  startMs: number,
  endMs: number
): Promise<{
  events: Awaited<ReturnType<typeof runHumioQueryWithLogging>>
  stats: SliceRunStats
  failed: boolean
}> {
  const emptyStats: SliceRunStats = { succeeded: 0, failed: 0, total: 0 }

  if (!shouldUseSlices(startMs, endMs)) {
    try {
      const events = await runHumioQueryWithLogging(
        "errorBreakdown",
        HUMIO_QUERIES.errorBreakdown,
        startMs,
        endMs,
        HUMIO_GROUPBY_POLL_LIMIT
      )
      return { events, stats: { succeeded: 1, failed: 0, total: 1 }, failed: false }
    } catch (error) {
      metricsLog.warn("humio", "Full-range errorBreakdown failed — trying slices", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    const { value, stats } = await mergeSlicedErrorBreakdown(
      HUMIO_QUERIES.errorBreakdown,
      startMs,
      endMs
    )
    const events = value as Awaited<ReturnType<typeof runHumioQueryWithLogging>>
    return { events, stats, failed: queryFailed(stats, events.length > 0) }
  } catch (error) {
    metricsLog.warn("humio", "Error breakdown slice fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { events: [], stats: emptyStats, failed: true }
  }
}

async function fetchReliability(
  startMs: number,
  endMs: number
): Promise<{
  totalRequests: number
  totalFailed: boolean
  errorBreakdownEvents: Awaited<ReturnType<typeof runHumioQueryWithLogging>>
  breakdownFailed: boolean
  sliceStats: { total: SliceRunStats; breakdown: SliceRunStats }
}> {
  const [totalResult, breakdownResult] = await Promise.all([
    fetchTotalRequests(startMs, endMs),
    fetchErrorBreakdown(startMs, endMs),
  ])

  return {
    totalRequests: totalResult.total,
    totalFailed: totalResult.failed,
    errorBreakdownEvents: breakdownResult.events,
    breakdownFailed: breakdownResult.failed,
    sliceStats: {
      total: totalResult.stats,
      breakdown: breakdownResult.stats,
    },
  }
}

function computeReliabilityFailed(
  totalRequests: number,
  totalFailed: boolean,
  breakdownFailed: boolean,
  errorBreakdownEvents: Awaited<ReturnType<typeof runHumioQueryWithLogging>>
): boolean {
  const hasBreakdown = errorBreakdownEvents.length > 0
  const hasTotal = totalRequests > 0

  if (totalFailed && breakdownFailed) return true
  if (!hasBreakdown && !hasTotal) return true
  if (hasTotal && breakdownFailed) return true
  if (hasBreakdown && totalFailed) return false

  return false
}

export async function fetchHumioMetrics(
  startISO: string,
  endISO: string
): Promise<HumioMetrics> {
  const startedAt = Date.now()
  const { startMs, endMs } = toEpochRange(startISO, endISO)

  const [reliabilityResult, payments] = await Promise.all([
    fetchReliability(startMs, endMs),
    parsePaymentFailures(startMs, endMs),
  ])

  const {
    totalRequests,
    totalFailed,
    errorBreakdownEvents,
    breakdownFailed,
    sliceStats,
  } = reliabilityResult

  const reliabilityFailed = computeReliabilityFailed(
    totalRequests,
    totalFailed,
    breakdownFailed,
    errorBreakdownEvents
  )

  const reliability = reliabilityFailed
    ? emptyReliability()
    : parseReliabilityFromEvents(errorBreakdownEvents, totalRequests)

  if (reliabilityFailed) {
    metricsLog.warn("humio", "Reliability fetch incomplete — will not cache", {
      startISO,
      endISO,
      totalRequests,
      totalFailed,
      breakdownFailed,
      errorBreakdownRows: errorBreakdownEvents.length,
      slicesOk: sliceStats.total.succeeded + sliceStats.breakdown.succeeded,
      slicesFailed: sliceStats.total.failed + sliceStats.breakdown.failed,
      mergedQueries: {
        totalRequests: buildHumioQuery(HUMIO_QUERIES.totalRequests),
        errorBreakdown: buildHumioQuery(HUMIO_QUERIES.errorBreakdown),
      },
    })
  } else if (
    reliability.failed_requests === 0 &&
    totalRequests === 0 &&
    errorBreakdownEvents.length === 0
  ) {
    metricsLog.warn("humio", "No reliability events returned — check query/fields", {
      startISO,
      endISO,
      mergedQueries: {
        totalRequests: buildHumioQuery(HUMIO_QUERIES.totalRequests),
        errorBreakdown: buildHumioQuery(HUMIO_QUERIES.errorBreakdown),
      },
    })
  }

  metricsLog.info("humio", "Metrics completed", {
    totalRequests,
    failedCount: reliability.failed_requests,
    errorBreakdownRows: errorBreakdownEvents.length,
    topFailedCount: reliability.top_failed_pages.length,
    paymentDeclined: payments.declined,
    paymentApproved: payments.approved,
    reliabilityFailed,
    totalSliceFailed: sliceStats.total.failed,
    breakdownSliceFailed: sliceStats.breakdown.failed,
    durationMs: Date.now() - startedAt,
  })

  return {
    reliability,
    payment_failures_declined: payments.declined,
    payment_failures_approved: payments.approved,
    reliabilityFailed,
  }
}
