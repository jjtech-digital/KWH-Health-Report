/** Canonical on-disk filename: `{year}-w{nn}.json` (e.g. `2026-w11.json`) */
export function weekJsonFilename(year: number, week: number): string {
  const paddedWeek = String(week).padStart(2, "0")
  return `${year}-w${paddedWeek}.json`
}

/** Regex for canonical and legacy filenames */
export const WEEK_JSON_FILENAME_PATTERN = /^(\d{4})-w(\d+)\.json$/i
export const LEGACY_WEEK_JSON_FILENAME_PATTERN = /^w(\d+)\.json$/i

export function parseWeekJsonFilename(
  filename: string,
  parentYear?: number
): { year: number; week: number } | null {
  const canonical = WEEK_JSON_FILENAME_PATTERN.exec(filename)
  if (canonical) {
    const year = Number.parseInt(canonical[1]!, 10)
    const week = Number.parseInt(canonical[2]!, 10)
    if (Number.isFinite(year) && Number.isFinite(week)) {
      return { year, week }
    }
  }

  if (parentYear !== undefined) {
    const legacy = LEGACY_WEEK_JSON_FILENAME_PATTERN.exec(filename)
    if (legacy) {
      const week = Number.parseInt(legacy[1]!, 10)
      if (Number.isFinite(week)) {
        return { year: parentYear, week }
      }
    }
  }

  return null
}

export interface WeekJsonManifestEntry {
  year: number
  week: number
  file: string
}

export interface WeekJsonManifest {
  updated_at: string
  weeks: WeekJsonManifestEntry[]
  by_year: Record<string, number[]>
}

export function buildWeekJsonManifest(
  entries: Array<{ year: number; week: number; file: string }>
): WeekJsonManifest {
  const sorted = [...entries].sort((a, b) => a.year - b.year || a.week - b.week)
  const by_year: Record<string, number[]> = {}

  for (const entry of sorted) {
    const key = String(entry.year)
    if (!by_year[key]) {
      by_year[key] = []
    }
    by_year[key].push(entry.week)
  }

  return {
    updated_at: new Date().toISOString(),
    weeks: sorted.map(({ year, week, file }) => ({ year, week, file })),
    by_year,
  }
}
