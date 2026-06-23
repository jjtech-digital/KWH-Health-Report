export const REDIS_KEY_PREFIX = "kwh-reports"

export function weekReportKey(year: number, week: number): string {
  return `${REDIS_KEY_PREFIX}:week:${year}:${week}`
}

export function weekRefreshLockKey(year: number, week: number): string {
  return `${REDIS_KEY_PREFIX}:refresh-lock:${year}:${week}`
}

/** 40m TTL — safety margin over 30m cron interval for current week */
export const CURRENT_WEEK_CACHE_TTL_SECONDS = 40 * 60

/** Stale-lock safety if a refresh crashes mid-flight */
export const REFRESH_LOCK_TTL_SECONDS = 10 * 60

/** Steal refresh locks older than this (crashed / interrupted refresh). */
export const REFRESH_LOCK_STALE_MS = 5 * 60 * 1000

/** Current week cache considered fresh below this age */
export const CURRENT_WEEK_STALE_MS = 30 * 60 * 1000
