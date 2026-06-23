import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  CT_BISECT_MINUTES,
  CT_INTERVAL_HOURS_ORDERS,
  CT_MAX_QUERY_TOTAL,
} from "./constants"
import { generateHourlyIntervals } from "./interval-generator"
import { runInBatches } from "./run-in-batches"

interface DateRange {
  from: string
  to: string
}

async function queryRangeTotal(
  metricFn: (from: string, to: string) => Promise<number>,
  from: string,
  to: string
): Promise<number> {
  return metricFn(from, to)
}

async function resolveLeafTotal(
  metricFn: (from: string, to: string) => Promise<number>,
  from: string,
  to: string
): Promise<number> {
  const total = await queryRangeTotal(metricFn, from, to)

  if (total < CT_MAX_QUERY_TOTAL) {
    return total
  }

  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()
  const midpointMs = fromMs + (CT_BISECT_MINUTES * 60 * 1000)

  if (midpointMs >= toMs) {
    metricsLog.warn("commercetools", "Range hit 10k cap but cannot bisect further", {
      from,
      to,
      total,
    })
    return total
  }

  const midpoint = new Date(midpointMs).toISOString()

  const [firstHalf, secondHalf] = await Promise.all([
    resolveLeafTotal(metricFn, from, midpoint),
    resolveLeafTotal(metricFn, midpoint, to),
  ])

  return firstHalf + secondHalf
}

/**
 * 1. Query full [from, to] → if total < CT_MAX_QUERY_TOTAL, return.
 * 2. If >= cap, split into time intervals (hourly by default).
 * 3. For each interval, recursively bisect if that interval still >= cap.
 * 4. Run interval queries via runInBatches.
 * 5. Sum leaf totals.
 */
export async function resolveCountWithBreakdown(
  metricFn: (from: string, to: string) => Promise<number>,
  from: string,
  to: string,
  options?: { intervalHours?: number; label?: string }
): Promise<number> {
  const intervalHours = options?.intervalHours ?? CT_INTERVAL_HOURS_ORDERS
  const label = options?.label

  const fullRangeTotal = await queryRangeTotal(metricFn, from, to)

  if (fullRangeTotal < CT_MAX_QUERY_TOTAL) {
    return fullRangeTotal
  }

  const intervals = generateHourlyIntervals(from, to, intervalHours)

  const intervalTotals = await runInBatches(
    intervals,
    async (interval: DateRange) => resolveLeafTotal(metricFn, interval.from, interval.to),
    { label }
  )

  return intervalTotals.reduce((sum, value) => sum + value, 0)
}
