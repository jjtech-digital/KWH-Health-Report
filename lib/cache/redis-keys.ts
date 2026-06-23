export const REDIS_KEY_PREFIX = "kwh-reports"

export function weekReportKey(year: number, week: number): string {
  return `${REDIS_KEY_PREFIX}:week:${year}:${week}`
}

export function weekSnapshotKey(year: number, week: number): string {
  return `${REDIS_KEY_PREFIX}:week-snapshot:${year}:${week}`
}

export function weekRefreshLockKey(year: number, week: number): string {
  return `${REDIS_KEY_PREFIX}:refresh-lock:${year}:${week}`
}

export type ProviderKeyName = "datadog" | "commercetools" | "humio"

export function providerCacheKey(
  year: number,
  week: number,
  provider: ProviderKeyName
): string {
  return `${REDIS_KEY_PREFIX}:provider:${year}:${week}:${provider}`
}

export function humioCheckpointKey(year: number, week: number): string {
  return `${REDIS_KEY_PREFIX}:humio-checkpoint:${year}:${week}`
}

export const POPULATE_CURSOR_KEY = `${REDIS_KEY_PREFIX}:populate-cursor`

export function providerCachePattern(year?: number, week?: number): string {
  if (year !== undefined && week !== undefined) {
    return `${REDIS_KEY_PREFIX}:provider:${year}:${week}:*`
  }
  return `${REDIS_KEY_PREFIX}:provider:*`
}

export function humioCheckpointPattern(year?: number, week?: number): string {
  if (year !== undefined && week !== undefined) {
    return humioCheckpointKey(year, week)
  }
  return `${REDIS_KEY_PREFIX}:humio-checkpoint:*`
}

/** 40m TTL — safety margin over 30m cron interval for current week */
export const CURRENT_WEEK_CACHE_TTL_SECONDS = 40 * 60

/** Stale-lock safety if a refresh crashes mid-flight (Humio checkpoints may span ticks) */
export const REFRESH_LOCK_TTL_SECONDS = 25 * 60

/** Steal refresh locks older than this (crashed / interrupted refresh). */
export const REFRESH_LOCK_STALE_MS = 5 * 60 * 1000

/** Current week cache considered fresh below this age */
export const CURRENT_WEEK_STALE_MS = 30 * 60 * 1000
