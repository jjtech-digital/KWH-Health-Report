import "server-only"

import type { HealthReportWeek } from "@/lib/types/health-report"
import { getReportCache } from "@/lib/cache"
import { refreshWeekProviders } from "./refresh-week-providers"

export interface AssembledWeekReport {
  report: HealthReportWeek
  cacheable: boolean
  providersFailed: string[]
}

export async function assembleWeekReport(
  year: number,
  week: number
): Promise<AssembledWeekReport> {
  const result = await refreshWeekProviders(year, week, {
    source: "cron",
  })

  const cached = await getReportCache().get(year, week)
  if (!cached?.report) {
    throw new Error(`Failed to assemble report for ${year} w${week}`)
  }

  return {
    report: cached.report,
    cacheable: result.cacheable,
    providersFailed: result.providersFailed,
  }
}

export { emptyHealthReportWeek } from "./merge-provider-caches"
