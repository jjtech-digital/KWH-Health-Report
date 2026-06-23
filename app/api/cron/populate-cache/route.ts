import { NextResponse } from "next/server"
import {
  METRICS_INVOCATION_BUDGET_MS,
  populateMissingWeeks,
} from "@/lib/services/populate-weeks"

export const runtime = "nodejs"
export const maxDuration = 300

function authorize(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET?.trim()
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)
}

async function runPopulate() {
  return populateMissingWeeks({
    deadlineMs: METRICS_INVOCATION_BUDGET_MS,
    source: "http",
  })
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runPopulate()
    return NextResponse.json(summary, { status: summary.done ? 200 : 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Populate failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Vercel cron invokes GET — same populate tick as POST */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runPopulate()
    return NextResponse.json(summary, { status: summary.done ? 200 : 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Populate failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
