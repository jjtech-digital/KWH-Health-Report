import type Redis from "ioredis"

export const REDIS_CONNECT_TIMEOUT_MS = 5_000
export const REDIS_CLI_READY_TIMEOUT_MS = 10_000
export const REDIS_SCAN_COUNT = 1_000

export function normalizeRedisHost(host: string): string {
  return host.replace(/^rediss?:\/\//, "").split(":")[0].replace(/\/$/, "")
}

export function resolveRedisTlsEnabled(redisUrl?: string): boolean {
  if (redisUrl?.startsWith("rediss://")) return true
  if (redisUrl?.startsWith("redis://")) return false

  const raw = process.env.REDIS_TLS?.trim().toLowerCase()
  if (raw === "true" || raw === "1") return true
  if (raw === "false" || raw === "0") return false

  return false
}

export function requireRedisEnv(): {
  host: string
  port: number
  username?: string
  password: string
} {
  const host = process.env.REDIS_HOST?.trim()
  const password = process.env.REDIS_PASSWORD?.trim()
  const username = process.env.REDIS_USERNAME?.trim()
  const port = Number.parseInt(process.env.REDIS_PORT ?? "19947", 10)

  if (!host || !password) {
    throw new Error(
      "Missing Redis configuration. Set REDIS_HOST and REDIS_PASSWORD in .env (local) or Vercel project settings."
    )
  }

  if (!Number.isFinite(port)) {
    throw new Error("REDIS_PORT must be a valid number")
  }

  return { host: normalizeRedisHost(host), port, username, password }
}

export function buildAppRedisOptions(tlsEnabled: boolean): import("ioredis").RedisOptions {
  return {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    ...(tlsEnabled ? { tls: {} } : {}),
  }
}

/** Fail-fast options for one-shot CLI scripts (no infinite reconnect). */
export function buildCliRedisOptions(tlsEnabled: boolean): import("ioredis").RedisOptions {
  return {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    retryStrategy: () => null,
    ...(tlsEnabled ? { tls: {} } : {}),
  }
}

export interface ScanClearStats {
  cleared: string[]
  scanIterations: number
  scanMs: number
  delMs: number
}

export async function scanAndUnlinkKeys(
  redis: Redis,
  pattern: string,
  scanCount = REDIS_SCAN_COUNT
): Promise<ScanClearStats> {
  const cleared: string[] = []
  let cursor = "0"
  let scanIterations = 0
  const scanStarted = Date.now()
  let delMs = 0

  do {
    const [nextCursor, found] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      scanCount
    )
    cursor = nextCursor
    scanIterations += 1

    if (found.length > 0) {
      const delStarted = Date.now()
      await redis.unlink(...found)
      delMs += Date.now() - delStarted
      cleared.push(...found)
    }
  } while (cursor !== "0")

  return {
    cleared,
    scanIterations,
    scanMs: Date.now() - scanStarted - delMs,
    delMs,
  }
}
