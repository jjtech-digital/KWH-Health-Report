type PopulateAction =
  | "skip"
  | "fast"
  | "humio"
  | "done"
  | "pause"
  | "error"
  | "start"
  | "tick"

let cliMode = false
let lastHumioLogKey = ""
let lastHumioLogAt = 0

export function setPopulateCliMode(enabled: boolean): void {
  cliMode = enabled
}

function formatWeek(year: number, week: number): string {
  return `${year}-w${week}`
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m${seconds}s`
}

function cliLine(message: string): void {
  console.log(`populate: ${message}`)
}

export function logPopulateCli(message: string): void {
  if (cliMode) cliLine(message)
}

export function logPopulateStart(weekCount: number, fromIndex: number): void {
  if (cliMode) {
    cliLine(
      weekCount === 1
        ? "1 week queued"
        : `${weekCount} weeks queued${fromIndex > 0 ? `, resuming at #${fromIndex + 1}` : ""}`
    )
  }
}

export function logHumioProgress(
  year: number,
  week: number,
  phase: string,
  sliceIndex: number,
  totalSlices: number
): void {
  if (!cliMode) return

  const key = `${year}:${week}:${phase}:${sliceIndex}`
  const now = Date.now()
  const isMilestone = sliceIndex === 0 || sliceIndex === totalSlices - 1 || sliceIndex % 10 === 0
  const heartbeat = now - lastHumioLogAt >= 30_000

  if (!isMilestone && !heartbeat && key === lastHumioLogKey) return

  lastHumioLogKey = key
  lastHumioLogAt = now
  cliLine(`${formatWeek(year, week)} humio ${phase} ${sliceIndex + 1}/${totalSlices}`)
}

export function logPopulate(line: {
  week: string
  action: PopulateAction
  reason?: string
  providers?: string[]
  phase?: string
  slice?: number
  total?: number
  cacheable?: boolean
  ms?: number
  resume?: boolean
  error?: string
  index?: number
  weekCount?: number
}): void {
  if (cliMode) {
    const duration = line.ms !== undefined ? ` ${formatDuration(line.ms)}` : ""

    switch (line.action) {
      case "start":
        cliLine(
          `${line.week} start${line.index !== undefined && line.weekCount ? ` (${line.index}/${line.weekCount})` : ""}`
        )
        break
      case "skip":
        cliLine(`${line.week} skip`)
        break
      case "fast":
        cliLine(`${line.week} datadog+ct${duration}`)
        break
      case "humio":
        cliLine(
          `${line.week} humio ${line.phase ?? ""} ${line.slice ?? 0}/${line.total ?? 0}`.trim()
        )
        break
      case "done":
        cliLine(
          `${line.week} done${line.cacheable === false ? " (partial)" : ""}${duration}`
        )
        break
      case "pause":
        cliLine(
          `${line.week} pause ${line.reason ?? "unknown"}${line.resume ? " — run again to resume" : ""}`
        )
        break
      case "tick":
        cliLine(`${line.week} humio tick${duration}`)
        break
      case "error":
        cliLine(`${line.week} error — ${line.error ?? "unknown"}`)
        break
      default:
        break
    }
    return
  }

  if (process.env.POPULATE_JSON === "1") {
    console.log(JSON.stringify({ op: "populate", ...line }))
  }
}

export function logPopulateSummary(
  summary: {
    skipped: number
    done: number
    paused: number
    errors: number
  },
  ms: number
): void {
  if (cliMode) {
    cliLine(
      `finished skipped=${summary.skipped} refreshed=${summary.done} paused=${summary.paused} errors=${summary.errors} (${formatDuration(ms)})`
    )
    return
  }

  if (process.env.POPULATE_JSON === "1") {
    console.log(JSON.stringify({ op: "populate", summary, ms }))
  }
}

export function weekLabel(year: number, week: number): string {
  return formatWeek(year, week)
}
