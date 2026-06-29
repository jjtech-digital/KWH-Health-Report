/** Shared Redis connection helpers for CLI scripts (mirrors lib/cache/redis-options.ts). */

export const REDIS_CONNECT_TIMEOUT_MS = 5_000
export const REDIS_CLI_READY_TIMEOUT_MS = 10_000
export const REDIS_SCAN_COUNT = 1_000

export function normalizeRedisHost(host) {
  return host.replace(/^rediss?:\/\//, "").split(":")[0].replace(/\/$/, "")
}

export function resolveRedisTlsEnabled(redisUrl) {
  if (redisUrl?.startsWith("rediss://")) return true
  if (redisUrl?.startsWith("redis://")) return false
  const raw = process.env.REDIS_TLS?.trim().toLowerCase()
  if (raw === "true" || raw === "1") return true
  if (raw === "false" || raw === "0") return false
  return false
}

export function buildCliRedisOptions(tlsEnabled) {
  return {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    retryStrategy: () => null,
    ...(tlsEnabled ? { tls: {} } : {}),
  }
}

export function createCliRedisClient(Redis) {
  const redisUrl = process.env.REDIS_URL?.trim()
  const tlsEnabled = resolveRedisTlsEnabled(redisUrl)
  const options = buildCliRedisOptions(tlsEnabled)

  if (redisUrl) {
    return new Redis(redisUrl, options)
  }

  const host = process.env.REDIS_HOST?.trim()
  const password = process.env.REDIS_PASSWORD?.trim()
  const username = process.env.REDIS_USERNAME?.trim()
  const port = Number.parseInt(process.env.REDIS_PORT ?? "19947", 10)

  if (!host || !password) {
    throw new Error("Missing REDIS_HOST or REDIS_PASSWORD in .env")
  }

  return new Redis({
    host: normalizeRedisHost(host),
    port,
    username: username || undefined,
    password,
    ...options,
  })
}

export function waitForRedisReady(client, timeoutMs = REDIS_CLI_READY_TIMEOUT_MS) {
  if (client.status === "ready") {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(
        new Error(
          "Redis connection timed out — check REDIS_HOST/REDIS_PORT/REDIS_TLS/REDIS_PASSWORD and VPN/network"
        )
      )
    }, timeoutMs)

    const onReady = () => {
      cleanup()
      resolve(undefined)
    }
    const onError = (error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timer)
      client.off("ready", onReady)
      client.off("error", onError)
    }

    client.once("ready", onReady)
    client.once("error", onError)
  })
}

export async function scanAndUnlinkKeys(client, pattern, scanCount = REDIS_SCAN_COUNT) {
  const cleared = []
  let cursor = "0"
  let scanIterations = 0
  const scanStarted = Date.now()
  let delMs = 0

  do {
    const [nextCursor, found] = await client.scan(
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
      await client.unlink(...found)
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
