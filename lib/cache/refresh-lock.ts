import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import { getRedisReady } from "./redis-client"
import {
  REFRESH_LOCK_STALE_MS,
  REFRESH_LOCK_TTL_SECONDS,
  weekRefreshLockKey,
} from "./redis-keys"

export interface RefreshLockPayload {
  startedAt: string
  source: "cron" | "manual" | "page"
  year: number
  week: number
}

function isStaleLock(lock: RefreshLockPayload): boolean {
  const started = Date.parse(lock.startedAt)
  if (!Number.isFinite(started)) return true
  return Date.now() - started > REFRESH_LOCK_STALE_MS
}

export async function acquireRefreshLock(
  year: number,
  week: number,
  source: RefreshLockPayload["source"]
): Promise<{ acquired: true } | { acquired: false; lock: RefreshLockPayload }> {
  const redis = await getRedisReady()
  const key = weekRefreshLockKey(year, week)
  const payload: RefreshLockPayload = {
    startedAt: new Date().toISOString(),
    source,
    year,
    week,
  }

  const ok = await redis.set(
    key,
    JSON.stringify(payload),
    "EX",
    REFRESH_LOCK_TTL_SECONDS,
    "NX"
  )

  if (ok === "OK") {
    return { acquired: true }
  }

  const raw = await redis.get(key)
  const existing = raw ? (JSON.parse(raw) as RefreshLockPayload) : payload

  if (isStaleLock(existing)) {
    metricsLog.warn("redis", "Stealing stale refresh lock", {
      year,
      week,
      startedAt: existing.startedAt,
      source: existing.source,
    })
    await redis.set(key, JSON.stringify(payload), "EX", REFRESH_LOCK_TTL_SECONDS)
    return { acquired: true }
  }

  return { acquired: false, lock: existing }
}

export async function releaseRefreshLock(year: number, week: number): Promise<void> {
  const redis = await getRedisReady()
  await redis.del(weekRefreshLockKey(year, week))
}

export async function getRefreshLock(
  year: number,
  week: number
): Promise<RefreshLockPayload | null> {
  const redis = await getRedisReady()
  const raw = await redis.get(weekRefreshLockKey(year, week))
  return raw ? (JSON.parse(raw) as RefreshLockPayload) : null
}
