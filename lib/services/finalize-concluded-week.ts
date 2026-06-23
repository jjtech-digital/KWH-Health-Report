import "server-only"

import { getReportCache } from "@/lib/cache"
import {
  persistWeekSnapshot,
  readWeekFromJsonFile,
} from "@/lib/data/week-json-store"
import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  getCurrentReportWeek,
  getPreviousReportWeek,
  isWeekConcluded,
} from "@/lib/weeks"

export interface FinalizeConcludedWeekResult {
  finalized: boolean
  year?: number
  week?: number
  reason?: string
}

/**
 * When the report week rolls forward, copy the last Redis merged cache for the
 * newly concluded week into JSON (and Redis snapshot) without live API queries.
 */
export async function finalizeRecentlyConcludedWeek(): Promise<FinalizeConcludedWeekResult> {
  const current = getCurrentReportWeek()
  const previous = getPreviousReportWeek(current)

  if (!previous) {
    return { finalized: false, reason: "no_previous_week" }
  }

  const { year, week } = previous

  if (!isWeekConcluded(year, week)) {
    return { finalized: false, year, week, reason: "not_concluded" }
  }

  if (readWeekFromJsonFile(year, week)) {
    return { finalized: false, year, week, reason: "json_exists" }
  }

  const cache = getReportCache()
  const cached = await cache.get(year, week)

  if (!cached?.report || !cached.cacheable) {
    return { finalized: false, year, week, reason: "no_cacheable_redis_cache" }
  }

  await persistWeekSnapshot(year, week, cached.report)

  metricsLog.info("redis", "concluded week finalized to JSON from Redis cache", {
    year,
    week,
    computedAt: cached.computedAt,
  })

  return { finalized: true, year, week }
}
