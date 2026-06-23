process.env.METRICS_LOG_QUIET = "1"

import { config } from "dotenv"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getReportCache } from "../lib/cache"
import { persistWeekSnapshot } from "../lib/data/week-json-store"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

function parseArgs(): { year: number; week: number } {
  const args = process.argv.slice(2)
  const year = args[0] ? Number.parseInt(args[0], 10) : NaN
  const week = args[1] ? Number.parseInt(args[1].replace(/^w/i, ""), 10) : NaN

  if (!Number.isFinite(year) || !Number.isFinite(week)) {
    throw new Error("Usage: tsx scripts/snapshot-week-to-json.mts <year> <week>")
  }

  return { year, week }
}

async function main() {
  const { year, week } = parseArgs()
  const cache = getReportCache()
  const cached = await cache.get(year, week)

  if (!cached?.report) {
    throw new Error(`No merged Redis cache for ${year}-w${week}`)
  }

  if (!cached.cacheable) {
    console.warn(`snapshot: ${year}-w${week} is not cacheable — writing snapshot anyway`)
  }

  await persistWeekSnapshot(year, week, cached.report)
  console.log(`snapshot: persisted ${year}-w${week} from Redis merged cache`)
}

main().catch((error) => {
  console.error(`snapshot: failed — ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
