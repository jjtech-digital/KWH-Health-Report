import "server-only"

import { getReportCache } from "@/lib/cache"
import { getAllProviderCaches } from "@/lib/cache/provider-cache"
import { acquireRefreshLock, releaseRefreshLock } from "@/lib/cache/refresh-lock"
import { CURRENT_WEEK_STALE_MS } from "@/lib/cache/redis-keys"
import { metricsLog } from "@/lib/logging/metrics-logger"
import type { CachedWeekReport, RefreshSource } from "@/lib/types/cache"
import {
  isCurrentReportWeek,
  isWeekConcluded,
} from "@/lib/weeks"
import { refreshWeekProviders } from "./refresh-week-providers"

export type RefreshSkipReason =
  | "cached_finalized"
  | "fresh_current"
  | "in_progress"
  | "concluded_json"

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

  if (concluded) {
    return {
      year,
      week,
      action: "skipped",
      reason: "concluded_json",
      durationMs: Date.now() - started,
    }
  }

  if (!opts.force) {
    const existing = await cache.get(year, week)
    if (
      isCurrentReportWeek(year, week) &&
      existing?.status === "ready" &&
      existing.cacheable
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
    const result = await refreshWeekProviders(year, week, {
      source: opts.source,
      force: opts.force,
      skipLock: true,
    })
    const durationMs = Date.now() - started
    const refreshed = await cache.get(year, week)

    if (!refreshed?.report) {
      throw new Error("Refresh produced no report")
    }

    if (result.cacheable) {
      metricsLog.info("cron", "week refresh refreshed", {
        year,
        week,
        source: opts.source,
        computedAt: refreshed.computedAt,
        durationMs,
        finalized: concluded,
      })

      return {
        year,
        week,
        action: "refreshed",
        computedAt: refreshed.computedAt,
        durationMs,
      }
    }

    if (previousSnapshot?.report && previousSnapshot.cacheable) {
      await cache.set(year, week, previousSnapshot)
      metricsLog.warn("redis", "Stale cache preserved after incomplete refresh", {
        year,
        week,
        source: opts.source,
        previousComputedAt: previousSnapshot.computedAt,
        providersFailed: result.providersFailed,
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

    metricsLog.warn("redis", "Partial report cached after incomplete refresh", {
      year,
      week,
      source: opts.source,
      providersFailed: result.providersFailed,
      durationMs,
    })

    return {
      year,
      week,
      action: result.paused ? "error" : "refreshed",
      reason: result.paused ? "in_progress" : undefined,
      computedAt: refreshed.computedAt,
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

export async function readWeekReportFromCache(
  year: number,
  week: number
): Promise<CachedWeekReport | null> {
  const cache = getReportCache()
  const cached = await cache.get(year, week)
  if (cached?.report) return cached

  const providers = await getAllProviderCaches(year, week)
  const hasAnyProvider =
    providers.datadog || providers.commercetools || providers.humio
  if (!hasAnyProvider) return null

  const { mergeProviderCaches } = await import("./merge-provider-caches")
  const merged = mergeProviderCaches(year, week, providers)
  const concluded = isWeekConcluded(year, week)

  return {
    report: merged.report,
    computedAt: merged.report.computed_at,
    status: "ready",
    finalized: concluded,
    cacheable: merged.cacheable,
  }
}
