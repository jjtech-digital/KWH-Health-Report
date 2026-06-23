import "server-only"

import { readFileSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { weekSnapshotKey } from "@/lib/cache/redis-keys"
import { getRedisReady } from "@/lib/cache/redis-client"
import { metricsLog } from "@/lib/logging/metrics-logger"
import type { HealthReportWeek } from "@/lib/types/health-report"
import { parseHealthReportWeek } from "@/lib/types/week-snapshot"
import {
  buildWeekJsonManifest,
  parseWeekJsonFilename,
  weekJsonFilename,
  type WeekJsonManifest,
} from "./week-json-naming"

const WEEKS_DIR = "data/weeks"
const MANIFEST_FILE = "manifest.json"

export function weekJsonPath(year: number, week: number): string {
  return path.join(process.cwd(), WEEKS_DIR, weekJsonFilename(year, week))
}

function legacyWeekJsonPath(year: number, week: number): string {
  const padded = String(week).padStart(2, "0")
  return path.join(process.cwd(), WEEKS_DIR, String(year), `w${padded}.json`)
}

function manifestPath(): string {
  return path.join(process.cwd(), WEEKS_DIR, MANIFEST_FILE)
}

function readJsonFileAt(filePath: string): HealthReportWeek | null {
  try {
    const raw = readFileSync(filePath, "utf8")
    return parseHealthReportWeek(JSON.parse(raw))
  } catch {
    return null
  }
}

export function readWeekFromJsonFile(year: number, week: number): HealthReportWeek | null {
  return (
    readJsonFileAt(weekJsonPath(year, week)) ??
    readJsonFileAt(legacyWeekJsonPath(year, week))
  )
}

export async function readWeekFromJsonFileAsync(
  year: number,
  week: number
): Promise<HealthReportWeek | null> {
  try {
    const raw = await readFile(weekJsonPath(year, week), "utf8")
    return parseHealthReportWeek(JSON.parse(raw))
  } catch {
    try {
      const raw = await readFile(legacyWeekJsonPath(year, week), "utf8")
      return parseHealthReportWeek(JSON.parse(raw))
    } catch {
      return null
    }
  }
}

export async function readWeekFromRedisSnapshot(
  year: number,
  week: number
): Promise<HealthReportWeek | null> {
  try {
    const redis = await getRedisReady()
    const raw = await redis.get(weekSnapshotKey(year, week))
    if (!raw) return null
    return parseHealthReportWeek(JSON.parse(raw))
  } catch (error) {
    metricsLog.warn("redis", "week snapshot read failed", {
      year,
      week,
      key: weekSnapshotKey(year, week),
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function readConcludedWeek(
  year: number,
  week: number
): Promise<HealthReportWeek | null> {
  const fromFile = readWeekFromJsonFile(year, week)
  if (fromFile) return fromFile

  return readWeekFromRedisSnapshot(year, week)
}

export async function writeWeekToJsonFile(
  year: number,
  week: number,
  report: HealthReportWeek
): Promise<void> {
  const root = path.join(process.cwd(), WEEKS_DIR)
  await mkdir(root, { recursive: true })
  const filePath = weekJsonPath(year, week)
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
}

export async function writeWeekToRedisSnapshot(
  year: number,
  week: number,
  report: HealthReportWeek
): Promise<void> {
  const redis = await getRedisReady()
  await redis.set(weekSnapshotKey(year, week), JSON.stringify(report))
}

export async function updateWeekJsonManifest(): Promise<WeekJsonManifest> {
  const entries = await listWeekJsonFiles()
  const manifest = buildWeekJsonManifest(
    entries.map(({ year, week, path: filePath }) => ({
      year,
      week,
      file: path.basename(filePath),
    }))
  )

  const root = path.join(process.cwd(), WEEKS_DIR)
  await mkdir(root, { recursive: true })
  await writeFile(manifestPath(), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  return manifest
}

export async function readWeekJsonManifest(): Promise<WeekJsonManifest | null> {
  try {
    const raw = await readFile(manifestPath(), "utf8")
    return JSON.parse(raw) as WeekJsonManifest
  } catch {
    return null
  }
}

export async function persistWeekSnapshot(
  year: number,
  week: number,
  report: HealthReportWeek
): Promise<void> {
  await writeWeekToRedisSnapshot(year, week, report)

  try {
    await writeWeekToJsonFile(year, week, report)
    await updateWeekJsonManifest()
    metricsLog.info("redis", "week snapshot persisted", {
      year,
      week,
      path: weekJsonPath(year, week),
    })
  } catch (error) {
    metricsLog.warn("redis", "week json file write skipped", {
      year,
      week,
      path: weekJsonPath(year, week),
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export interface WeekJsonEntry {
  year: number
  week: number
  path: string
}

export async function listWeekJsonFiles(): Promise<WeekJsonEntry[]> {
  const root = path.join(process.cwd(), WEEKS_DIR)
  const entries: WeekJsonEntry[] = []
  const seen = new Set<string>()

  const addEntry = (year: number, week: number, filePath: string) => {
    const key = `${year}:${week}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push({ year, week, path: filePath })
  }

  let rootFiles: string[]
  try {
    rootFiles = await readdir(root)
  } catch {
    return entries
  }

  for (const file of rootFiles) {
    if (file === MANIFEST_FILE) continue
    const parsed = parseWeekJsonFilename(file)
    if (parsed) {
      addEntry(parsed.year, parsed.week, path.join(root, file))
    }
  }

  for (const entry of rootFiles) {
    const year = Number.parseInt(entry, 10)
    if (!Number.isFinite(year)) continue

    let nestedFiles: string[]
    try {
      nestedFiles = await readdir(path.join(root, entry))
    } catch {
      continue
    }

    for (const file of nestedFiles) {
      const parsed = parseWeekJsonFilename(file, year)
      if (parsed) {
        addEntry(parsed.year, parsed.week, path.join(root, entry, file))
      }
    }
  }

  return entries.sort((a, b) => a.year - b.year || a.week - b.week)
}

export { weekJsonFilename, MANIFEST_FILE, WEEKS_DIR }
