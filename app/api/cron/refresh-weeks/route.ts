import { NextResponse } from "next/server"
import {
  METRICS_INVOCATION_BUDGET_MS,
  populateMissingWeeks,
} from "@/lib/services/populate-weeks"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await populateMissingWeeks({
      deadlineMs: METRICS_INVOCATION_BUDGET_MS,
      source: "cron",
    })
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron refresh failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
