import type { HealthReportWeek } from "./health-report"

export type ReportCacheStatus = "ready" | "computing" | "error"

export type RefreshSource = "cron" | "manual" | "page"

export interface CachedWeekReport {
  report: HealthReportWeek
  computedAt: string
  status: ReportCacheStatus
  /** True once the report week has ended at write time */
  finalized: boolean
  /** All providers succeeded and Humio reliability is valid */
  cacheable?: boolean
  refreshedBy?: RefreshSource
  error?: string
}
