import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"
import { updateWeekJsonManifest, weekJsonPath } from "../lib/data/week-json-store"
import { listConcludedReportWeeks } from "../lib/weeks"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")

async function main() {
  const concluded = listConcludedReportWeeks()
  const missing: string[] = []

  for (const { year, week } of concluded) {
    const path = weekJsonPath(year, week)
    if (!existsSync(path)) {
      missing.push(`${year}-w${week} (${path.replace(REPO_ROOT + "/", "")})`)
    }
  }

  const manifest = await updateWeekJsonManifest()
  const years = Object.keys(manifest.by_year).sort()

  console.log(`weeks:manifest: ${manifest.weeks.length} week file(s) across ${years.length} year(s)`)
  for (const year of years) {
    const weeks = manifest.by_year[year] ?? []
    console.log(`  ${year}: weeks ${weeks.join(", ")}`)
  }

  if (missing.length > 0) {
    console.error(`\nweeks:validate: missing ${missing.length} JSON file(s) for concluded weeks:`)
    for (const label of missing) {
      console.error(`  - ${label}`)
    }
    process.exit(1)
  }

  console.log(`\nweeks:validate: ok — ${concluded.length} concluded week(s) have JSON files`)
}

main().catch((error) => {
  console.error(`weeks:validate: failed — ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
