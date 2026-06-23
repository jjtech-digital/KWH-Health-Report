import "server-only"

import type { HealthReportWeek } from "@/lib/types/health-report"
import { getReportCache } from "@/lib/cache"
import { getRefreshLock } from "@/lib/cache/refresh-lock"
import { weekReportKey } from "@/lib/cache/redis-keys"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { refreshWeekIfNeeded } from "./week-refresh"

const IN_PROGRESS_POLL_MS = 2_000
const IN_PROGRESS_MAX_WAIT_MS = 120_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForCachedReport(
  year: number,
  week: number
): Promise<HealthReportWeek | null> {
  const cache = getReportCache()
  const deadline = Date.now() + IN_PROGRESS_MAX_WAIT_MS

  while (Date.now() < deadline) {
    const cached = await cache.get(year, week)
    if (cached?.report) {
      return cached.report
    }

    const lock = await getRefreshLock(year, week)
    if (!lock) {
      return null
    }

    await sleep(IN_PROGRESS_POLL_MS)
  }

  return null
}

export async function getWeekReport(
  year: number,
  week: number,
  options?: { force?: boolean }
): Promise<HealthReportWeek> {
  const cache = getReportCache()
  const cacheKey = weekReportKey(year, week)

  if (!options?.force) {
    try {
      const cached = await cache.get(year, week)
      if (cached?.report) {
        return cached.report
      }
    } catch (error) {
      metricsLog.error("redis", "cache get failed", error, {
        year,
        week,
        key: cacheKey,
        operation: "get",
      })
    }
  }

  const result = await refreshWeekIfNeeded(year, week, {
    force: options?.force,
    source: options?.force ? "manual" : "page",
  })

  if (result.action === "skipped") {
    if (result.reason === "in_progress") {
      const waited = await waitForCachedReport(year, week)
      if (waited) {
        return waited
      }

      const retry = await refreshWeekIfNeeded(year, week, {
        force: options?.force,
        source: options?.force ? "manual" : "page",
      })

      if (retry.action === "refreshed" || retry.action === "skipped") {
        const cached = await cache.get(year, week)
        if (cached?.report) {
          return cached.report
        }
      }

      if (retry.action === "error") {
        const cached = await cache.get(year, week)
        if (cached?.report) {
          return cached.report
        }
      }

      throw new Error(`Report refresh in progress for ${year} w${week}`)
    }

    const cached = await cache.get(year, week)
    if (cached?.report) {
      return cached.report
    }
  }

  if (result.action === "error") {
    const cached = await cache.get(year, week)
    if (cached?.report) {
      if (result.stalePreserved) {
        metricsLog.warn("assembler", "Serving stale report after refresh failure", {
          year,
          week,
          computedAt: cached.computedAt,
          reason: result.reason,
        })
      }
      return cached.report
    }
    throw new Error(result.reason ?? `Failed to load report for ${year} w${week}`)
  }

  const cached = await cache.get(year, week)
  if (cached?.report) {
    return cached.report
  }

  throw new Error(`Report unavailable for ${year} w${week}`)
}

export async function getWeekReportMetadata(
  year: number,
  week: number
): Promise<{ computedAt: string | null; status: string; finalized: boolean }> {
  try {
    const cache = getReportCache()
    const cached = await cache.get(year, week)
    return {
      computedAt: cached?.computedAt ?? null,
      status: cached?.status ?? "missing",
      finalized: cached?.finalized ?? false,
    }
  } catch (error) {
    metricsLog.error("redis", "cache metadata get failed", error, {
      year,
      week,
      key: weekReportKey(year, week),
      operation: "getMetadata",
    })
    return { computedAt: null, status: "missing", finalized: false }
  }
}
