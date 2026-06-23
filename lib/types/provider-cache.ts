import type { CommercetoolsMetrics, DatadogMetrics, HumioMetrics } from "./metrics"

export type ProviderName = "datadog" | "commercetools" | "humio"

export type ProviderStatus = "ready" | "error"

export interface ProviderCacheEntry<T> {
  data: T
  computedAt: string
  status: ProviderStatus
}

export type DatadogProviderEntry = ProviderCacheEntry<DatadogMetrics>
export type CommercetoolsProviderEntry = ProviderCacheEntry<CommercetoolsMetrics>
export type HumioProviderEntry = ProviderCacheEntry<HumioMetrics>

export interface PopulateCursor {
  year: number
  week: number
}

export type HumioCheckpointPhase = "totalRequests" | "errorBreakdown" | "payments"

export interface HumioCheckpoint {
  startedAt: number
  phase: HumioCheckpointPhase
  sliceIndex: number
  partialTotalRequests: number
  partialBreakdownEvents: Record<string, unknown>[]
  totalSliceStats: { succeeded: number; failed: number; total: number }
  breakdownSliceStats: { succeeded: number; failed: number; total: number }
  paymentsDeclined?: number
  paymentsApproved?: number
}
