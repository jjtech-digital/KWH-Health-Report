process.env.METRICS_LOG_QUIET = "1"

import { config } from "dotenv"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

function parseArgs(): { year?: number; week?: number } {
  const args = process.argv.slice(2)
  const year = args[0] ? Number.parseInt(args[0], 10) : undefined
  const week = args[1] ? Number.parseInt(args[1].replace(/^w/i, ""), 10) : undefined
  if (year !== undefined && !Number.isFinite(year)) {
    throw new Error("Usage: tsx scripts/populate-redis-cache.mts [year week]")
  }
  if (week !== undefined && !Number.isFinite(week)) {
    throw new Error("Usage: tsx scripts/populate-redis-cache.mts [year week]")
  }
  return { year, week }
}

async function main() {
  const { year, week } = parseArgs()
  const filter = year !== undefined && week !== undefined ? { year, week } : undefined
  const { getCurrentReportWeek } = await import("../lib/weeks")
  const current = getCurrentReportWeek()

  console.log(
    filter
      ? `populate: starting current week ${filter.year}-w${filter.week}`
      : `populate: starting current week ${current.year}-w${current.week}`
  )

  const { populateMissingWeeks } = await import("../lib/services/populate-weeks")

  let pass = 0
  let summary = await populateMissingWeeks({ source: "cli", filter, cli: true })

  while (summary.humioInProgress) {
    pass += 1
    console.log(`populate: resume pass ${pass + 1}`)
    summary = await populateMissingWeeks({ source: "cli", filter, cli: true })
  }

  if (summary.errors.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`populate: failed — ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
