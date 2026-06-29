import type {
  Customers,
  Ecommerce,
  Reliability,
  Traffic,
  WebVitals,
} from "./health-report"

export interface DateRangeISO {
  startISO: string
  endISO: string
}

export interface CommercetoolsMetrics {
  ecommerce: Pick<Ecommerce, "total_orders" | "active_carts">
  customers: Pick<
    Customers,
    | "first_time_buyers"
    | "returning_customers"
    | "guest_checkouts"
    | "registered_user_orders"
    | "total_registered_users"
  >
  /** Metric modes that failed during fetch (partial results may still be present). */
  failedModes?: string[]
}

export interface HumioMetrics {
  reliability: Reliability
  payment_failures_declined: number
  payment_failures_approved: number
  /** True when totalRequests or errorBreakdown could not be fetched. */
  reliabilityFailed?: boolean
}

export interface DatadogMetrics {
  traffic: Traffic
  web_vitals: WebVitals
  payment_failures_declined: number
  payment_failures_approved: number
}
