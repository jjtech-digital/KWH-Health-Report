import "server-only"

import { getReportCache } from "@/lib/cache"
import { acquireRefreshLock, releaseRefreshLock } from "@/lib/cache/refresh-lock"
import { CURRENT_WEEK_STALE_MS } from "@/lib/cache/redis-keys"
import { metricsLog } from "@/lib/logging/metrics-logger"
import type { CachedWeekReport, RefreshSource } from "@/lib/types/cache"
import {
  isCurrentReportWeek,
  isWeekConcluded,
} from "@/lib/weeks"
import { assembleWeekReport } from "./report-assembler"

export type RefreshSkipReason =
  | "cached_finalized"
  | "fresh_current"
  | "in_progress"

export interface WeekRefreshResult {
  year: number
  week: number
  action: "refreshed" | "skipped" | "error"
  reason?: RefreshSkipReason | string
  computedAt?: string
  durationMs?: number
  stalePreserved?: boolean
}

export async function refreshWeekIfNeeded(
  year: number,
  week: number,
  opts: { force?: boolean; source: RefreshSource }
): Promise<WeekRefreshResult> {
  const started = Date.now()
  const cache = getReportCache()
  const concluded = isWeekConcluded(year, week)

  if (!opts.force) {
    const existing = await cache.get(year, week)
    if (concluded && existing?.status === "ready" && existing.finalized) {
      return { year, week, action: "skipped", reason: "cached_finalized" }
    }
    if (
      !concluded &&
      isCurrentReportWeek(year, week) &&
      existing?.status === "ready"
    ) {
      const age = Date.now() - new Date(existing.computedAt).getTime()
      if (age < CURRENT_WEEK_STALE_MS) {
        return { year, week, action: "skipped", reason: "fresh_current" }
      }
    }
  }

  const lock = await acquireRefreshLock(year, week, opts.source)
  if (!lock.acquired) {
    return { year, week, action: "skipped", reason: "in_progress" }
  }

  let previousSnapshot: CachedWeekReport | null = null

  try {
    previousSnapshot = await cache.get(year, week)
    const { report, cacheable, providersFailed } = await assembleWeekReport(year, week)
    const durationMs = Date.now() - started

    if (cacheable) {
      await cache.set(year, week, {
        report,
        computedAt: report.computed_at,
        status: "ready",
        finalized: concluded,
        refreshedBy: opts.source,
      })

      metricsLog.info("cron", "week refresh refreshed", {
        year,
        week,
        source: opts.source,
        computedAt: report.computed_at,
        durationMs,
        finalized: concluded,
      })

      return {
        year,
        week,
        action: "refreshed",
        computedAt: report.computed_at,
        durationMs,
      }
    }

    if (previousSnapshot?.report) {
      await cache.set(year, week, previousSnapshot)
      metricsLog.warn("redis", "Stale cache preserved after incomplete refresh", {
        year,
        week,
        source: opts.source,
        previousComputedAt: previousSnapshot.computedAt,
        providersFailed,
      })

      return {
        year,
        week,
        action: "error",
        reason: "incomplete_report",
        computedAt: previousSnapshot.computedAt,
        durationMs,
        stalePreserved: true,
      }
    }

    await cache.set(year, week, {
      report,
      computedAt: report.computed_at,
      status: "ready",
      finalized: false,
      refreshedBy: opts.source,
    })

    metricsLog.warn("redis", "Partial report cached after incomplete refresh", {
      year,
      week,
      source: opts.source,
      providersFailed,
      durationMs,
    })

    return {
      year,
      week,
      action: "refreshed",
      computedAt: report.computed_at,
      durationMs,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    const durationMs = Date.now() - started

    if (previousSnapshot?.report) {
      try {
        await cache.set(year, week, previousSnapshot)
        metricsLog.warn("redis", "Stale cache preserved after refresh failure", {
          year,
          week,
          source: opts.source,
          previousComputedAt: previousSnapshot.computedAt,
          error: message,
        })
      } catch (restoreError) {
        metricsLog.error("redis", "Failed to restore stale cache", restoreError, {
          year,
          week,
        })
      }

      return {
        year,
        week,
        action: "error",
        reason: message,
        computedAt: previousSnapshot.computedAt,
        durationMs,
        stalePreserved: true,
      }
    }

    metricsLog.error("cron", "week refresh failed", err, { year, week, source: opts.source })
    return { year, week, action: "error", reason: message, durationMs }
  } finally {
    await releaseRefreshLock(year, week)
  }
}
