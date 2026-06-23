import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildWeekJsonManifest,
  parseWeekJsonFilename,
  weekJsonFilename,
} from "../lib/data/week-json-naming"

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEEKS_ROOT = resolve(__dirname, "../data/weeks")

async function main() {
  const migrated: Array<{ year: number; week: number; from: string; to: string }> = []

  let rootEntries: string[]
  try {
    rootEntries = await readdir(WEEKS_ROOT)
  } catch {
    console.log("migrate-week-json: no data/weeks directory")
    return
  }

  for (const entry of rootEntries) {
    const year = Number.parseInt(entry, 10)
    if (!Number.isFinite(year)) continue

    const yearDir = path.join(WEEKS_ROOT, entry)
    let files: string[]
    try {
      files = await readdir(yearDir)
    } catch {
      continue
    }

    for (const file of files) {
      const parsed = parseWeekJsonFilename(file, year)
      if (!parsed) continue

      const from = path.join(yearDir, file)
      const to = path.join(WEEKS_ROOT, weekJsonFilename(parsed.year, parsed.week))

      if (from === to) continue

      await copyFile(from, to)
      migrated.push({
        year: parsed.year,
        week: parsed.week,
        from: path.relative(WEEKS_ROOT, from),
        to: path.basename(to),
      })
    }

    await rm(yearDir, { recursive: true, force: true })
  }

  await mkdir(WEEKS_ROOT, { recursive: true })

  const manifest = buildWeekJsonManifest(
    migrated.map(({ year, week, to }) => ({ year, week, file: to }))
  )

  if (migrated.length === 0) {
    const existing = rootEntries
      .filter((f) => parseWeekJsonFilename(f))
      .map((file) => {
        const parsed = parseWeekJsonFilename(file)!
        return { year: parsed.year, week: parsed.week, file }
      })

    if (existing.length > 0) {
      const fullManifest = buildWeekJsonManifest(existing)
      await writeFile(
        path.join(WEEKS_ROOT, "manifest.json"),
        `${JSON.stringify(fullManifest, null, 2)}\n`,
        "utf8"
      )
      console.log(`migrate-week-json: manifest updated (${existing.length} files, already canonical)`)
      return
    }

    console.log("migrate-week-json: nothing to migrate")
    return
  }

  await writeFile(
    path.join(WEEKS_ROOT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  )

  console.log(`migrate-week-json: migrated ${migrated.length} file(s)`)
  for (const row of migrated) {
    console.log(`  ${row.from} → ${row.to}`)
  }
}

main().catch((error) => {
  console.error(`migrate-week-json: failed — ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
