import "server-only"

import {
  readConcludedWeek,
  readWeekFromJsonFile,
  readWeekFromRedisSnapshot,
} from "@/lib/data/week-json-store"
import type { HealthReportWeek } from "@/lib/types/health-report"
import { getReportCache } from "@/lib/cache"
import { weekReportKey } from "@/lib/cache/redis-keys"
import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  isCurrentReportWeek,
  isWeekConcluded,
} from "@/lib/weeks"
import { emptyHealthReportWeek } from "./merge-provider-caches"
import { readWeekReportFromCache } from "./week-refresh"

const IN_PROGRESS_MAX_WAIT_MS = 1_200_000

export type WeekReportSource = "redis" | "json-file" | "json-snapshot" | "empty"

export async function getWeekReport(
  year: number,
  week: number,
  options?: { force?: boolean }
): Promise<HealthReportWeek> {
  if (options?.force) {
    if (isWeekConcluded(year, week)) {
      const report = await readConcludedWeek(year, week)
      return report ?? emptyHealthReportWeek(year, week)
    }

    const { refreshWeekIfNeeded } = await import("./week-refresh")
    await refreshWeekIfNeeded(year, week, { force: true, source: "manual" })
    const cache = getReportCache()
    const cached = await cache.get(year, week)
    if (cached?.report) {
      return cached.report
    }
  }

  if (isCurrentReportWeek(year, week)) {
    try {
      const partial = await readWeekReportFromCache(year, week)
      if (partial?.report) {
        return partial.report
      }
    } catch (error) {
      metricsLog.error("redis", "cache get failed", error, {
        year,
        week,
        key: weekReportKey(year, week),
        operation: "get",
      })
    }

    return emptyHealthReportWeek(year, week)
  }

  if (isWeekConcluded(year, week)) {
    const report = await readConcludedWeek(year, week)
    if (report) return report
  }

  return emptyHealthReportWeek(year, week)
}

export async function getWeekReportMetadata(
  year: number,
  week: number
): Promise<{
  computedAt: string | null
  status: string
  finalized: boolean
  cacheable: boolean
  source: WeekReportSource
}> {
  if (isCurrentReportWeek(year, week)) {
    try {
      const partial = await readWeekReportFromCache(year, week)
      if (partial?.report) {
        return {
          computedAt: partial.computedAt,
          status: partial.status,
          finalized: partial.finalized,
          cacheable: partial.cacheable ?? false,
          source: "redis",
        }
      }
    } catch (error) {
      metricsLog.error("redis", "cache metadata get failed", error, {
        year,
        week,
        key: weekReportKey(year, week),
        operation: "getMetadata",
      })
    }

    return {
      computedAt: null,
      status: "missing",
      finalized: false,
      cacheable: false,
      source: "empty",
    }
  }

  if (isWeekConcluded(year, week)) {
    const fromFile = readWeekFromJsonFile(year, week)
    if (fromFile) {
      return {
        computedAt: fromFile.computed_at,
        status: "ready",
        finalized: true,
        cacheable: true,
        source: "json-file",
      }
    }

    const fromSnapshot = await readWeekFromRedisSnapshot(year, week)
    if (fromSnapshot) {
      return {
        computedAt: fromSnapshot.computed_at,
        status: "ready",
        finalized: true,
        cacheable: true,
        source: "json-snapshot",
      }
    }
  }

  return {
    computedAt: null,
    status: "missing",
    finalized: false,
    cacheable: false,
    source: "empty",
  }
}

export { IN_PROGRESS_MAX_WAIT_MS }
