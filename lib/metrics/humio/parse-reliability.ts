import "server-only"

import type { FailedPage, Reliability } from "@/lib/types/health-report"
import type { HumioEvent } from "./client"

const COUNT_FIELD_KEYS = ["_count", "count", "#count"] as const

function readCount(event: HumioEvent): number {
  for (const key of COUNT_FIELD_KEYS) {
    const value = event[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 1
}

function readHook(event: HumioEvent): string | null {
  const hook = event.hook ?? event["hook"]
  if (typeof hook === "string" && hook.length > 0) return hook
  return null
}

function readOutgoingStatus(event: HumioEvent): number | null {
  const candidates = [
    event["context.outgoingRequest.statusCode"],
    event.extension_status_code,
    event["incomingRequest.statusCode"],
    event.statusCode,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate
    if (typeof candidate === "string") {
      const parsed = Number.parseInt(candidate, 10)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return null
}

function parseFailureRow(event: HumioEvent): FailedPage | null {
  const hook = readHook(event)
  const status = readOutgoingStatus(event)
  if (!hook || status === null) return null

  return {
    path: hook,
    status,
    failures: readCount(event),
  }
}

function parseFailureRows(events: HumioEvent[]): FailedPage[] {
  const pages: FailedPage[] = []
  for (const event of events) {
    const row = parseFailureRow(event)
    if (row) pages.push(row)
  }
  return pages
}

export function parseReliabilityFromEvents(
  errorBreakdownEvents: HumioEvent[],
  totalRequests: number
): Reliability {
  const failureRows = parseFailureRows(errorBreakdownEvents)
  const failed_requests = failureRows.reduce((sum, row) => sum + row.failures, 0)
  const top_failed_pages = failureRows.toSorted((a, b) => b.failures - a.failures).slice(0, 5)

  const error_rate =
    totalRequests > 0
      ? `${((failed_requests / totalRequests) * 100).toFixed(4)}%`
      : failed_requests > 0
        ? "N/A"
        : "0%"

  return {
    failed_requests,
    error_rate,
    top_failed_pages,
  }
}
