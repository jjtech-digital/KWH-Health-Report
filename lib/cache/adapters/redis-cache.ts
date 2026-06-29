import "server-only"

import type { CachedWeekReport } from "@/lib/types/cache"
import { isCurrentReportWeek } from "@/lib/weeks"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { getRedisReady } from "../redis-client"
import {
  CURRENT_WEEK_CACHE_TTL_SECONDS,
  weekReportKey,
} from "../redis-keys"
import type { ReportCachePort } from "../report-cache-port"

export class RedisCacheAdapter implements ReportCachePort {
  async get(year: number, week: number): Promise<CachedWeekReport | null> {
    const key = weekReportKey(year, week)
    const redis = await getRedisReady()
    const raw = await redis.get(key)
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as CachedWeekReport
  }

  async set(year: number, week: number, value: CachedWeekReport): Promise<void> {
    const key = weekReportKey(year, week)
    const payload = JSON.stringify(value)
    const redis = await getRedisReady()

    if (isCurrentReportWeek(year, week)) {
      await redis.setex(key, CURRENT_WEEK_CACHE_TTL_SECONDS, payload)
      metricsLog.info("redis", "cache set", { key, ttlSeconds: CURRENT_WEEK_CACHE_TTL_SECONDS })
      return
    }

    await redis.set(key, payload)
    metricsLog.info("redis", "cache set", { key, ttlSeconds: null })
  }

  async invalidate(year: number, week: number): Promise<void> {
    const key = weekReportKey(year, week)
    const redis = await getRedisReady()
    await redis.del(key)
    metricsLog.info("redis", "cache invalidated", { key })
  }
}
