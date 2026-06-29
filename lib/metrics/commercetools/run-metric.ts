import "server-only"

import {
  fetchCartTotal,
  fetchLoggedInOrderTotal,
  fetchAnonymousOrderTotal,
  fetchRepeatedCustOrderTotal,
  fetchOrderTotal,
  fetchCustomersCreatedTotal,
} from "./cart-fetcher"
import { countFirstTimeBuyersForWeek } from "./first-time-buyers"
import { resolveCountWithBreakdown } from "./metric-breakdown"
import { CT_INTERVAL_HOURS_CART, CT_INTERVAL_HOURS_FTB } from "./constants"

export type MetricMode =
  | "CART_TOTAL"
  | "FIRST_TIME_BUYERS"
  | "LOGGED_IN_ORDERS"
  | "ANONYMOUS_ORDERS"
  | "REPEATED_ORDERS"
  | "TOTAL_ORDERS"
  | "TOTAL_CUSTOMERS"

export async function runMetric(
  mode: MetricMode,
  startDate: string,
  endDate: string,
  options?: { signal?: AbortSignal }
): Promise<number> {
  const signal = options?.signal

  switch (mode) {
    case "CART_TOTAL":
      return resolveCountWithBreakdown(fetchCartTotal, startDate, endDate, {
        intervalHours: CT_INTERVAL_HOURS_CART,
        label: "CART_TOTAL",
        signal,
      })
    case "TOTAL_ORDERS":
      return resolveCountWithBreakdown(fetchOrderTotal, startDate, endDate, {
        label: "TOTAL_ORDERS",
        signal,
      })
    case "LOGGED_IN_ORDERS":
      return resolveCountWithBreakdown(fetchLoggedInOrderTotal, startDate, endDate, {
        label: "LOGGED_IN_ORDERS",
        signal,
      })
    case "ANONYMOUS_ORDERS":
      return resolveCountWithBreakdown(fetchAnonymousOrderTotal, startDate, endDate, {
        label: "ANONYMOUS_ORDERS",
        signal,
      })
    case "TOTAL_CUSTOMERS":
      return resolveCountWithBreakdown(fetchCustomersCreatedTotal, startDate, endDate, {
        label: "TOTAL_CUSTOMERS",
        signal,
      })
    case "FIRST_TIME_BUYERS":
      return countFirstTimeBuyersForWeek(startDate, endDate, CT_INTERVAL_HOURS_FTB, {
        signal,
      })
    case "REPEATED_ORDERS":
      return fetchRepeatedCustOrderTotal(startDate, endDate)
    default: {
      const _exhaustive: never = mode
      throw new Error(`Unknown metric mode: ${_exhaustive}`)
    }
  }
}
