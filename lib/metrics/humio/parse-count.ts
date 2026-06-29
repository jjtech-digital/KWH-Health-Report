import "server-only"

import type { HumioEvent } from "./client"

const COUNT_FIELD_KEYS = ["_count", "count", "#count"] as const

function parseAggregateFromEvents(events: HumioEvent[]): number | null {
  for (const event of events) {
    for (const key of COUNT_FIELD_KEYS) {
      const value = event[key]
      if (typeof value === "number" && Number.isFinite(value)) {
        return value
      }
      if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10)
        if (Number.isFinite(parsed)) {
          return parsed
        }
      }
    }
  }
  return null
}

export function parseHumioCount(
  events: HumioEvent[],
  metaData?: { eventCount?: number },
  options?: { preferAggregateFields?: boolean }
): number {
  if (options?.preferAggregateFields) {
    const aggregate = parseAggregateFromEvents(events)
    if (aggregate !== null) {
      return aggregate
    }
  }

  if (metaData?.eventCount !== undefined && Number.isFinite(metaData.eventCount)) {
    return metaData.eventCount
  }

  const aggregate = parseAggregateFromEvents(events)
  if (aggregate !== null) {
    return aggregate
  }

  return events.length
}

export function hasParseableHumioCount(
  events: HumioEvent[],
  metaData?: { eventCount?: number }
): boolean {
  if (parseAggregateFromEvents(events) !== null) return true
  if (metaData?.eventCount !== undefined && Number.isFinite(metaData.eventCount)) {
    return true
  }
  return events.length > 0
}
