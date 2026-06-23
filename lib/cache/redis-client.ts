import "server-only"

import Redis from "ioredis"
import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  buildAppRedisOptions,
  requireRedisEnv,
  resolveRedisTlsEnabled,
  scanAndUnlinkKeys,
} from "./redis-options"

let client: Redis | null = null

export function getRedisClient(): Redis {
  if (client) return client

  const redisUrl = process.env.REDIS_URL?.trim()
  const tlsEnabled = resolveRedisTlsEnabled(redisUrl)
  const options = buildAppRedisOptions(tlsEnabled)

  if (redisUrl) {
    client = new Redis(redisUrl, options)
    metricsLog.info("redis", "client initialized", {
      connection: "REDIS_URL",
      tls: tlsEnabled,
    })
  } else {
    const { host, port, username, password } = requireRedisEnv()

    client = new Redis({
      host,
      port,
      username: username || undefined,
      password,
      ...options,
    })

    metricsLog.info("redis", "client initialized", {
      host,
      port,
      tls: tlsEnabled,
    })
  }

  client.on("connect", () => {
    metricsLog.info("redis", "connected")
  })

  client.on("error", (error) => {
    metricsLog.error("redis", "connection error", error, {
      hint:
        error instanceof Error &&
        error.message.includes("wrong version number") &&
        tlsEnabled
          ? "REDIS_TLS may be wrong — try REDIS_TLS=false for plain TCP endpoints"
          : undefined,
    })
  })

  return client
}

let readyPromise: Promise<Redis> | null = null

export async function getRedisReady(): Promise<Redis> {
  const redis = getRedisClient()

  if (redis.status === "ready") {
    return redis
  }

  if (!readyPromise) {
    readyPromise = new Promise<Redis>((resolve, reject) => {
      const onReady = () => {
        cleanup()
        resolve(redis)
      }
      const onError = (error: Error) => {
        cleanup()
        readyPromise = null
        reject(error)
      }
      const cleanup = () => {
        redis.off("ready", onReady)
        redis.off("error", onError)
      }

      if (redis.status === "ready") {
        cleanup()
        resolve(redis)
        return
      }

      redis.once("ready", onReady)
      redis.once("error", onError)
    })
  }

  return readyPromise
}

export { scanAndUnlinkKeys }
