import { NextResponse } from "next/server"
import { clearReportCache } from "@/lib/cache/clear-report-cache"
import { parseWeekParam, parseYearParam } from "@/lib/weeks"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get("year")
  const weekParam = searchParams.get("week")

  const year = yearParam ? parseYearParam(yearParam) : null
  const week = weekParam ? parseWeekParam(weekParam) : null

  if ((yearParam && year === null) || (weekParam && week === null)) {
    return NextResponse.json({ error: "Invalid year or week query parameter" }, { status: 400 })
  }

  if ((yearParam && !weekParam) || (!yearParam && weekParam)) {
    return NextResponse.json(
      { error: "Provide both year and week query parameters, or omit both to clear all cached reports" },
      { status: 400 }
    )
  }

  try {
    const result = await clearReportCache(
      year !== null && week !== null ? { year, week } : undefined
    )
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cache clear failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
