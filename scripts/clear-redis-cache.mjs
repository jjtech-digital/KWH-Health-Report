#!/usr/bin/env node

import { config } from "dotenv"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import Redis from "ioredis"
import {
  createCliRedisClient,
  waitForRedisReady,
  scanAndUnlinkKeys,
} from "./redis-config.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

const KEY_PREFIX = "kwh-reports"

function weekReportKey(year, week) {
  return `${KEY_PREFIX}:week:${year}:${week}`
}

function weekRefreshLockKey(year, week) {
  return `${KEY_PREFIX}:refresh-lock:${year}:${week}`
}

async function main() {
  const [yearArg, weekArg] = process.argv.slice(2)
  console.log("Connecting to Redis…")
  const connectStarted = Date.now()
  const client = createCliRedisClient(Redis)

  try {
    await waitForRedisReady(client)
    const connectMs = Date.now() - connectStarted
    console.log(`Connected in ${connectMs}ms`)

    if (yearArg && weekArg) {
      const year = Number.parseInt(yearArg, 10)
      const week = Number.parseInt(weekArg.replace(/^w/i, ""), 10)
      if (!Number.isFinite(year) || !Number.isFinite(week)) {
        throw new Error("Usage: node scripts/clear-redis-cache.mjs [year week]")
      }
      const keys = [weekReportKey(year, week), weekRefreshLockKey(year, week)]
      const delStarted = Date.now()
      await client.unlink(...keys)
      console.log(`Cleared ${keys.length} key(s) in ${Date.now() - delStarted}ms:`)
      for (const key of keys) {
        console.log(`  ${key}`)
      }
    } else if (yearArg || weekArg) {
      throw new Error("Provide both year and week, or omit both to clear all cached reports")
    } else {
      const weekPattern = `${KEY_PREFIX}:week:*`
      const lockPattern = `${KEY_PREFIX}:refresh-lock:*`

      const weekResult = await scanAndUnlinkKeys(client, weekPattern)
      const lockResult = await scanAndUnlinkKeys(client, lockPattern)
      const cleared = [...weekResult.cleared, ...lockResult.cleared]

      console.log(
        `Cleared ${cleared.length} key(s) — ${weekResult.cleared.length} week, ${lockResult.cleared.length} lock (scan ${weekResult.scanMs + lockResult.scanMs}ms, unlink ${weekResult.delMs + lockResult.delMs}ms)`
      )
      for (const key of cleared) {
        console.log(`  ${key}`)
      }
    }

    process.exit(0)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  } finally {
    client.quit().catch(() => undefined)
  }
}

main()
