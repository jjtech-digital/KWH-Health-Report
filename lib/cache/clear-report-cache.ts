import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import { getRedisReady, scanAndUnlinkKeys } from "./redis-client"
import { REDIS_KEY_PREFIX, weekRefreshLockKey, weekReportKey } from "./redis-keys"

export interface ClearReportCacheOptions {
  year?: number
  week?: number
}

export interface ClearReportCacheResult {
  cleared: string[]
}

export async function clearReportCache(
  options?: ClearReportCacheOptions
): Promise<ClearReportCacheResult> {
  const redis = await getRedisReady()

  if (options?.year !== undefined && options?.week !== undefined) {
    const key = weekReportKey(options.year, options.week)
    const lockKey = weekRefreshLockKey(options.year, options.week)
    await redis.unlink(key, lockKey)
    metricsLog.info("redis", "cache cleared", { key, lockKey, scope: "week" })
    return { cleared: [key, lockKey] }
  }

  const weekPattern = `${REDIS_KEY_PREFIX}:week:*`
  const lockPattern = `${REDIS_KEY_PREFIX}:refresh-lock:*`

  const [weekResult, lockResult] = await Promise.all([
    scanAndUnlinkKeys(redis, weekPattern),
    scanAndUnlinkKeys(redis, lockPattern),
  ])

  const cleared = [...weekResult.cleared, ...lockResult.cleared]

  metricsLog.info("redis", "cache cleared", {
    scope: "all",
    keyCount: cleared.length,
    weekKeys: weekResult.cleared.length,
    lockKeys: lockResult.cleared.length,
    scanMs: weekResult.scanMs + lockResult.scanMs,
    delMs: weekResult.delMs + lockResult.delMs,
    scanIterations: weekResult.scanIterations + lockResult.scanIterations,
  })

  return { cleared }
}
