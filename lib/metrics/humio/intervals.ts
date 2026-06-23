import "server-only"

import { HUMIO_SLICE_HOURS } from "./constants"

export interface TimeSlice {
  startMs: number
  endMs: number
}

export function splitRangeIntoSlices(
  startMs: number,
  endMs: number,
  sliceHours = HUMIO_SLICE_HOURS
): TimeSlice[] {
  if (endMs <= startMs) return []

  const sliceMs = sliceHours * 60 * 60 * 1000
  const slices: TimeSlice[] = []

  for (let cursor = startMs; cursor < endMs; cursor += sliceMs) {
    slices.push({
      startMs: cursor,
      endMs: Math.min(cursor + sliceMs, endMs),
    })
  }

  return slices
}
