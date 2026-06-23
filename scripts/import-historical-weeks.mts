import { execSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import { persistWeekSnapshot } from "../lib/data/week-json-store"
import type { HealthReportWeek } from "../lib/types/health-report"
import { getWeekDateRangeISO } from "../lib/weeks"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const HISTORICAL_COMMIT = "bd4a34c"
const HISTORICAL_YEAR = 2026

config({ path: resolve(REPO_ROOT, ".env") })

interface LegacyWeekEntry {
  week_number: number
  traffic: HealthReportWeek["traffic"]
  reliability: HealthReportWeek["reliability"]
  ecommerce: HealthReportWeek["ecommerce"]
  customers: HealthReportWeek["customers"]
  web_vitals: HealthReportWeek["web_vitals"]
}

async function loadHistoricalHealthData(): Promise<LegacyWeekEntry[]> {
  const raw = execSync(`git show ${HISTORICAL_COMMIT}:lib/data.ts`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })

  const cacheDir = resolve(__dirname, ".cache")
  await mkdir(cacheDir, { recursive: true })
  const tempPath = resolve(cacheDir, "historical-data.ts")
  await writeFile(tempPath, raw, "utf8")

  const mod = (await import(pathToFileURL(tempPath).href)) as {
    healthData: LegacyWeekEntry[]
  }

  if (!Array.isArray(mod.healthData) || mod.healthData.length === 0) {
    throw new Error(`No healthData array found in ${HISTORICAL_COMMIT}:lib/data.ts`)
  }

  return mod.healthData
}

function toHealthReportWeek(entry: LegacyWeekEntry): HealthReportWeek {
  const { endISO } = getWeekDateRangeISO(HISTORICAL_YEAR, entry.week_number)

  return {
    week_number: entry.week_number,
    year: HISTORICAL_YEAR,
    computed_at: endISO,
    traffic: entry.traffic,
    reliability: entry.reliability,
    ecommerce: entry.ecommerce,
    customers: entry.customers,
    web_vitals: entry.web_vitals,
  }
}

async function main() {
  console.log(`import-historical: loading lib/data.ts from ${HISTORICAL_COMMIT}`)

  const entries = await loadHistoricalHealthData()
  const weeks = [...entries].sort((a, b) => a.week_number - b.week_number)

  console.log(`import-historical: found ${weeks.length} weeks`)

  for (const entry of weeks) {
    const report = toHealthReportWeek(entry)
    await persistWeekSnapshot(HISTORICAL_YEAR, entry.week_number, report)
    console.log(
      `  w${String(entry.week_number).padStart(2, "0")}: views=${report.traffic.total_views} orders=${report.ecommerce.total_orders}`
    )
  }

  console.log(`import-historical: done — wrote ${weeks.length} JSON files to data/weeks/ (${HISTORICAL_YEAR}-w01.json … ${HISTORICAL_YEAR}-w${weeks.length})`)
}

main().catch((error) => {
  console.error(
    `import-historical: failed — ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
})
