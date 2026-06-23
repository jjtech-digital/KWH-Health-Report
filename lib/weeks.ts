import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from "date-fns"
import { TZDate } from "@date-fns/tz"
import { REPORT_TIMEZONE, nowInReportTz } from "@/lib/timezone"

/** First calendar year with report weeks (week 1 anchored Feb 2). */
export const REPORT_FIRST_YEAR = 2026

export interface WeekEntry {
  year: number
  week: number
  monthWeek: number
  label: string
  startDate: Date
  endDate: Date
  month: string
  monthIndex: number
}

export interface MonthGroup {
  month: string
  monthIndex: number
  weeks: WeekEntry[]
}

export interface YearGroup {
  year: number
  months: MonthGroup[]
}

function endInclusive(end: Date): TZDate {
  const endTz = new TZDate(end, REPORT_TIMEZONE)
  endTz.setHours(23, 59, 59, 999)
  return endTz
}

export function getWeekDateRange(year: number, week: number) {
  const feb2 = new TZDate(year, 1, 2, REPORT_TIMEZONE)
  const startOfFirstWeek = startOfWeek(feb2, { weekStartsOn: 1 })
  const weekStart = addWeeks(startOfFirstWeek, week - 1)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  return { start: weekStart, end: weekEnd }
}

export function getWeekDateRangeISO(year: number, week: number) {
  const { start, end } = getWeekDateRange(year, week)
  const endBound = endInclusive(end)

  return {
    startISO: new Date(start.getTime()).toISOString(),
    endISO: new Date(endBound.getTime()).toISOString(),
  }
}

export function getWeekCacheTag(year: number, week: number): string {
  return `week-report-${year}-${week}`
}

export function getCurrentReportWeek(now = nowInReportTz()): { year: number; week: number } {
  const year = now.getFullYear()

  for (let w = 1; w <= 53; w++) {
    const { start, end } = getWeekDateRange(year, w)
    const endBound = endInclusive(end)
    if (now >= start && now <= endBound) {
      return { year, week: w }
    }
  }

  return { year, week: 1 }
}

/** Report week immediately before `current` (cross-year when current is week 1). */
export function getPreviousReportWeek(
  current: { year: number; week: number }
): { year: number; week: number } | null {
  if (current.week > 1) {
    return { year: current.year, week: current.week - 1 }
  }

  const previousYear = current.year - 1
  const lastWeek = getLastReportWeekOfYear(previousYear)
  if (lastWeek <= 0) {
    return null
  }

  return { year: previousYear, week: lastWeek }
}

export function isCurrentReportWeek(
  year: number,
  week: number,
  now = nowInReportTz()
): boolean {
  const current = getCurrentReportWeek(now)
  return current.year === year && current.week === week
}

/** @deprecated Use isCurrentReportWeek */
export function isCurrentWeek(year: number, week: number): boolean {
  return isCurrentReportWeek(year, week)
}

export function isWeekConcluded(
  year: number,
  week: number,
  now = nowInReportTz()
): boolean {
  const { end } = getWeekDateRange(year, week)
  return now > endInclusive(end)
}

export function parseWeekParam(weekParam: string): number | null {
  const weekNum = Number.parseInt(weekParam.replace(/^w/i, ""), 10)
  return Number.isFinite(weekNum) ? weekNum : null
}

export function parseYearParam(yearParam: string): number | null {
  const year = Number.parseInt(yearParam, 10)
  return Number.isFinite(year) ? year : null
}

/** @deprecated Use planCronWeeks from refresh-weeks.ts */
export function getWeeksToRefresh(): Array<{ year: number; week: number }> {
  const current = getCurrentReportWeek()
  const weeks: Array<{ year: number; week: number }> = [current]

  if (current.week > 1) {
    weeks.push({ year: current.year, week: current.week - 1 })
  }

  return weeks
}

export function getMaxReportWeekForYear(year: number, now = nowInReportTz()): number {
  const current = getCurrentReportWeek(now)
  if (year < current.year) {
    return getLastReportWeekOfYear(year)
  }
  if (year > current.year) {
    return 0
  }
  return current.week
}

function getLastReportWeekOfYear(year: number): number {
  for (let w = 53; w >= 1; w--) {
    const { start } = getWeekDateRange(year, w)
    if (start.getFullYear() === year || new TZDate(start, REPORT_TIMEZONE).getFullYear() === year) {
      return w
    }
  }
  return 52
}

export function listConcludedReportWeeks(
  now = nowInReportTz()
): Array<{ year: number; week: number }> {
  const current = getCurrentReportWeek(now)
  const weeks: Array<{ year: number; week: number }> = []

  for (let y = current.year; y >= REPORT_FIRST_YEAR; y--) {
    const maxWeek = getMaxReportWeekForYear(y, now)
    for (let w = 1; w <= maxWeek; w++) {
      if (!isWeekConcluded(y, w, now)) {
        continue
      }

      const { start } = getWeekDateRange(y, w)
      const monthIdx = new TZDate(start, REPORT_TIMEZONE).getMonth()
      if (monthIdx === 0 || monthIdx === 11) {
        continue
      }

      weeks.push({ year: y, week: w })
    }
  }

  return weeks
}

export function listReportYears(now = nowInReportTz()): number[] {
  const current = getCurrentReportWeek(now)
  const years: number[] = []
  for (let y = current.year; y >= REPORT_FIRST_YEAR; y--) {
    years.push(y)
  }
  return years
}

export function generateReportIndex(): YearGroup[] {
  const now = nowInReportTz()
  const current = getCurrentReportWeek(now)
  const years: YearGroup[] = []

  for (let y = current.year; y >= REPORT_FIRST_YEAR; y--) {
    const maxWeek = getMaxReportWeekForYear(y, now)
    const monthMap = new Map<string, WeekEntry[]>()

    for (let w = 1; w <= maxWeek; w++) {
      if (!isWeekConcluded(y, w, now)) {
        continue
      }

      const { start, end } = getWeekDateRange(y, w)
      const startTz = new TZDate(start, REPORT_TIMEZONE)
      const endTz = new TZDate(end, REPORT_TIMEZONE)
      const monthIdx = startTz.getMonth()

      if (monthIdx === 0 || monthIdx === 11) {
        continue
      }

      const monthName = format(startTz, "MMMM")

      const entry: WeekEntry = {
        year: y,
        week: w,
        monthWeek: 0,
        label: `${format(startTz, "d MMM")} – ${format(endTz, "d MMM")}`,
        startDate: new Date(start.getTime()),
        endDate: new Date(end.getTime()),
        month: monthName,
        monthIndex: monthIdx,
      }

      const key = `${monthIdx}-${monthName}`
      if (!monthMap.has(key)) {
        monthMap.set(key, [])
      }
      monthMap.get(key)!.push(entry)
    }

    const months: MonthGroup[] = []
    for (const [key, weekEntries] of monthMap) {
      const [idxStr, month] = key.split("-")

      weekEntries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      weekEntries.forEach((entry, index) => {
        entry.monthWeek = index + 1
      })

      months.push({
        month,
        monthIndex: parseInt(idxStr, 10),
        weeks: weekEntries,
      })
    }

    months.sort((a, b) => b.monthIndex - a.monthIndex)
    years.push({ year: y, months })
  }

  return years
}
