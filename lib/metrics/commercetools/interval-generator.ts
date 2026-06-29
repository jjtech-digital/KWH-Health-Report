export function generateHourlyIntervals(
  startISO: string,
  endISO: string,
  hours: number
): Array<{ from: string; to: string }> {
  const intervals: Array<{ from: string; to: string }> = []

  let cursor = new Date(startISO)
  const end = new Date(endISO)

  while (cursor < end) {
    const next = new Date(cursor)
    next.setHours(next.getHours() + hours)

    intervals.push({
      from: cursor.toISOString(),
      to: next > end ? end.toISOString() : next.toISOString(),
    })

    cursor = next
  }

  return intervals
}
