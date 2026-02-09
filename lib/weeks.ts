import {
  startOfWeek,
  endOfWeek,
  getISOWeek,
  getISOWeekYear,
  addWeeks,
  startOfYear,
  format,
} from "date-fns"

export interface WeekEntry {
  year: number
  week: number
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

export function getWeekDateRange(year: number, week: number) {
  const jan4 = new Date(year, 0, 4)
  const startOfFirstWeek = startOfWeek(jan4, { weekStartsOn: 1 })
  const weekStart = addWeeks(startOfFirstWeek, week - 1)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  return { start: weekStart, end: weekEnd }
}

export function generateReportIndex(): YearGroup[] {
  const now = new Date()
  const currentISOWeek = getISOWeek(now)
  const currentISOYear = getISOWeekYear(now)

  const years: YearGroup[] = []

  for (let y = currentISOYear; y >= currentISOYear; y--) {
    const maxWeek = y === currentISOYear ? currentISOWeek : getISOWeeksInYear(y)
    const monthMap = new Map<string, WeekEntry[]>()

    for (let w = 1; w <= maxWeek; w++) {
      const { start, end } = getWeekDateRange(y, w)

      // Only add the week if the current day has passed it
      if (now <= end) {
        continue
      }
      
      const monthName = format(start, "MMMM")
      const monthIdx = start.getMonth()

      // Skip January and December
      if (monthIdx === 0 || monthIdx === 11) {
        continue
      }

      const entry: WeekEntry = {
        year: y,
        week: w,
        label: `${format(start, "d MMM")} – ${format(end, "d MMM")}`,
        startDate: start,
        endDate: end,
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
    for (const [key, weeks] of monthMap) {
      const [idxStr, month] = key.split("-")
      
      // Sort weeks by start date and renumber starting from 1 for each month
      weeks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      weeks.forEach((week, index) => {
        week.week = index + 1
      })

      months.push({
        month,
        monthIndex: parseInt(idxStr, 10),
        weeks,
      })
    }

    months.sort((a, b) => b.monthIndex - a.monthIndex)

    years.push({ year: y, months })
  }

  return years
}

function getISOWeeksInYear(year: number): number {
  const dec28 = new Date(year, 11, 28)
  return getISOWeek(dec28)
}
