import { NextResponse } from "next/server"
import { getWeekReport } from "@/lib/services/get-week-report"
import { parseWeekParam, parseYearParam } from "@/lib/weeks"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ year: string; week: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { year: yearParam, week: weekParam } = await context.params
  const year = parseYearParam(yearParam)
  const week = parseWeekParam(weekParam)

  if (year === null || week === null) {
    return NextResponse.json({ error: "Invalid year or week" }, { status: 400 })
  }

  try {
    const report = await getWeekReport(year, week)
    return NextResponse.json(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load report"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
