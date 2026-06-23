import "server-only"

import type { CommercetoolsMetrics } from "@/lib/types/metrics"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { CT_FTB_TIMEOUT_MS, runMetricResilient } from "./run-metric-resilient"
import type { MetricMode } from "./run-metric"

const FIRST_TIME_BUYERS_MODE: MetricMode = "FIRST_TIME_BUYERS"

const FAST_METRIC_SEQUENCE: Array<{
  mode: MetricMode
  key: keyof typeof FAST_RESULT_KEYS
}> = [
  { mode: "TOTAL_ORDERS", key: "total_orders" },
  { mode: "CART_TOTAL", key: "active_carts" },
  { mode: "ANONYMOUS_ORDERS", key: "guest_checkouts" },
  { mode: "LOGGED_IN_ORDERS", key: "registered_user_orders" },
  { mode: "REPEATED_ORDERS", key: "returning_customers" },
  { mode: "TOTAL_CUSTOMERS", key: "total_registered_users" },
]

const FAST_RESULT_KEYS = {
  total_orders: true,
  active_carts: true,
  guest_checkouts: true,
  registered_user_orders: true,
  returning_customers: true,
  total_registered_users: true,
  first_time_buyers: true,
} as const

/**
 * Semantic notes (match existing dashboard labels):
 * - total_registered_users: customers created in the week, not cumulative platform total
 * - returning_customers: unique emails with 2+ orders in the period
 * - active_carts: carts modified in range with line items, not live active count
 */
export async function fetchCommercetoolsMetrics(
  startISO: string,
  endISO: string
): Promise<CommercetoolsMetrics> {
  const startedAt = Date.now()
  const results: Record<string, number> = {}
  const failedModes: MetricMode[] = []

  await Promise.all(
    FAST_METRIC_SEQUENCE.map(async ({ mode, key }) => {
      try {
        results[key] = await runMetricResilient(mode, startISO, endISO)
      } catch (error) {
        failedModes.push(mode)
        metricsLog.warn("commercetools", "Metric mode failed", {
          mode,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  )

  try {
    results.first_time_buyers = await runMetricResilient(
      FIRST_TIME_BUYERS_MODE,
      startISO,
      endISO,
      { timeoutMs: CT_FTB_TIMEOUT_MS }
    )
  } catch (error) {
    failedModes.push(FIRST_TIME_BUYERS_MODE)
    results.first_time_buyers = 0
    metricsLog.warn("commercetools", "Metric mode failed", {
      mode: FIRST_TIME_BUYERS_MODE,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const metrics: CommercetoolsMetrics = {
    ecommerce: {
      total_orders: results.total_orders ?? 0,
      active_carts: results.active_carts ?? 0,
    },
    customers: {
      first_time_buyers: results.first_time_buyers ?? 0,
      guest_checkouts: results.guest_checkouts ?? 0,
      registered_user_orders: results.registered_user_orders ?? 0,
      returning_customers: results.returning_customers ?? 0,
      total_registered_users: results.total_registered_users ?? 0,
    },
    ...(failedModes.length > 0 ? { failedModes } : {}),
  }

  metricsLog.info("commercetools", "Metrics completed", {
    total_orders: metrics.ecommerce.total_orders,
    active_carts: metrics.ecommerce.active_carts,
    first_time_buyers: metrics.customers.first_time_buyers,
    guest_checkouts: metrics.customers.guest_checkouts,
    registered_user_orders: metrics.customers.registered_user_orders,
    returning_customers: metrics.customers.returning_customers,
    total_registered_users: metrics.customers.total_registered_users,
    failedModes,
    durationMs: Date.now() - startedAt,
  })

  return metrics
}
