import "server-only"

import { getReportCache } from "@/lib/cache"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { getCurrentReportWeek } from "@/lib/weeks"
import { refreshWeekIfNeeded, type WeekRefreshResult } from "./week-refresh"

export interface CronRefreshSummary {
  durationMs: number
  results: WeekRefreshResult[]
  refreshed: Array<{ year: number; week: number; computedAt?: string }>
  skipped: Array<{ year: number; week: number; reason?: string }>
  errors: Array<{ year: number; week: number; message: string }>
}

export async function planCronWeeks(): Promise<Array<{ year: number; week: number; priority: number }>> {
  const current = getCurrentReportWeek()
  return [{ year: current.year, week: current.week, priority: 0 }]
}

export async function runCronRefresh(): Promise<CronRefreshSummary> {
  const t0 = Date.now()
  const results: WeekRefreshResult[] = []

  for (const { year, week } of await planCronWeeks()) {
    results.push(await refreshWeekIfNeeded(year, week, { source: "cron" }))
  }

  const refreshed = results
    .filter((r) => r.action === "refreshed")
    .map(({ year, week, computedAt }) => ({ year, week, computedAt }))

  const skipped = results
    .filter((r) => r.action === "skipped")
    .map(({ year, week, reason }) => ({ year, week, reason }))

  const errors = results
    .filter((r) => r.action === "error")
    .map(({ year, week, reason }) => ({
      year,
      week,
      message: reason ?? "unknown",
    }))

  const summary: CronRefreshSummary = {
    durationMs: Date.now() - t0,
    results,
    refreshed,
    skipped,
    errors,
  }

  metricsLog.info("cron", "refresh complete", {
    durationMs: summary.durationMs,
    refreshed,
    skipped,
    errors,
  })

  return summary
}

/** @deprecated Use runCronRefresh */
export async function refreshScheduledWeeks(): Promise<{
  refreshed: Array<{ year: number; week: number; computedAt: string }>
  errors: Array<{ year: number; week: number; message: string }>
}> {
  const summary = await runCronRefresh()
  return {
    refreshed: summary.refreshed.map((r) => ({
      year: r.year,
      week: r.week,
      computedAt: r.computedAt ?? new Date().toISOString(),
    })),
    errors: summary.errors,
  }
}
