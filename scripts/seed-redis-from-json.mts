process.env.METRICS_LOG_QUIET = "1"

import { config } from "dotenv"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getReportCache } from "../lib/cache"
import {
  listWeekJsonFiles,
  readWeekFromJsonFileAsync,
} from "../lib/data/week-json-store"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

function parseArgs(): { year?: number; week?: number; dryRun: boolean } {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const positional = args.filter((arg) => arg !== "--dry-run")
  const year = positional[0] ? Number.parseInt(positional[0], 10) : undefined
  const week = positional[1]
    ? Number.parseInt(positional[1].replace(/^w/i, ""), 10)
    : undefined

  if (year !== undefined && !Number.isFinite(year)) {
    throw new Error("Usage: tsx scripts/seed-redis-from-json.mts [--dry-run] [year week]")
  }
  if (week !== undefined && !Number.isFinite(week)) {
    throw new Error("Usage: tsx scripts/seed-redis-from-json.mts [--dry-run] [year week]")
  }

  return { year, week, dryRun }
}

async function main() {
  const { year, week, dryRun } = parseArgs()
  const cache = getReportCache()

  let files = await listWeekJsonFiles()
  if (year !== undefined && week !== undefined) {
    files = files.filter((entry) => entry.year === year && entry.week === week)
  }

  if (files.length === 0) {
    console.log("seed-redis-from-json: no JSON files matched")
    return
  }

  console.log(`seed-redis-from-json: ${dryRun ? "dry-run " : ""}${files.length} week(s)`)

  for (const entry of files) {
    const report = await readWeekFromJsonFileAsync(entry.year, entry.week)
    if (!report) {
      console.warn(`  skip ${entry.year}-w${entry.week}: invalid or missing JSON`)
      continue
    }

    if (dryRun) {
      console.log(`  would seed ${entry.year}-w${entry.week}`)
      continue
    }

    await cache.set(entry.year, entry.week, {
      report,
      computedAt: report.computed_at,
      status: "ready",
      finalized: true,
      cacheable: true,
      refreshedBy: "cron",
    })

    console.log(`  seeded ${entry.year}-w${entry.week}`)
  }

  console.log("seed-redis-from-json: done")
}

main().catch((error) => {
  console.error(
    `seed-redis-from-json: failed — ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
})
