import { NextResponse } from "next/server"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { getWeekReport } from "@/lib/services/get-week-report"
import { refreshWeekIfNeeded } from "@/lib/services/week-refresh"
import { parseWeekParam, parseYearParam } from "@/lib/weeks"

export const runtime = "nodejs"
export const maxDuration = 300

interface RouteContext {
  params: Promise<{ year: string; week: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { year: yearParam, week: weekParam } = await context.params
  const year = parseYearParam(yearParam)
  const week = parseWeekParam(weekParam)

  if (year === null || week === null) {
    return NextResponse.json({ error: "Invalid year or week" }, { status: 400 })
  }

  try {
    const result = await refreshWeekIfNeeded(year, week, { force: true, source: "manual" })

    if (result.reason === "in_progress") {
      metricsLog.info("cron", "refresh lock busy", { year, week, source: "manual" })
      return NextResponse.json({ status: "in_progress" }, { status: 409 })
    }

    if (result.action === "error") {
      return NextResponse.json({ error: result.reason }, { status: 500 })
    }

    const report = await getWeekReport(year, week)
    return NextResponse.json({
      status: "ready",
      computedAt: report.computed_at,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh report"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
