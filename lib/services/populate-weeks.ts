import { getReportCache } from "@/lib/cache"
import {
  getPopulateCursor,
  setPopulateCursor,
} from "@/lib/cache/provider-cache"
import { CURRENT_WEEK_STALE_MS } from "@/lib/cache/redis-keys"
import { METRICS_INVOCATION_BUDGET_MS } from "@/lib/config/metrics-timeouts"
import { logPopulate, logPopulateStart, logPopulateSummary, logHumioProgress, weekLabel, setPopulateCliMode } from "@/lib/logging/populate-logger"
import type { RefreshSource } from "@/lib/types/cache"
import {
  getCurrentReportWeek,
  isCurrentReportWeek,
} from "@/lib/weeks"
import { finalizeRecentlyConcludedWeek } from "./finalize-concluded-week"
import { refreshWeekProviders } from "./refresh-week-providers"

export interface PopulateMissingWeeksOptions {
  deadlineMs?: number
  source?: RefreshSource | "cli" | "http"
  filter?: { year: number; week: number }
  cli?: boolean
}

export interface PopulateSummary {
  done: boolean
  cursor: { year: number; week: number } | null
  skipped: number
  refreshed: number
  humioInProgress: boolean
  errors: Array<{ year: number; week: number; message: string }>
  durationMs: number
  finalizedWeek?: { year: number; week: number }
}

function buildPopulateWeekList(
  filter?: { year: number; week: number }
): Array<{ year: number; week: number }> {
  const current = getCurrentReportWeek()

  if (filter) {
    if (filter.year !== current.year || filter.week !== current.week) {
      throw new Error(
        `Cache populate only runs for the current week (${current.year}-w${current.week}). ` +
          `Concluded weeks use committed JSON — past weeks are not refreshed via populate.`
      )
    }
    return [filter]
  }

  return [current]
}

async function shouldSkipPopulateWeek(year: number, week: number): Promise<boolean> {
  if (!isCurrentReportWeek(year, week)) {
    return true
  }

  const cache = getReportCache()
  const cached = await cache.get(year, week)
  if (!cached || cached.status !== "ready" || !cached.cacheable) {
    return false
  }

  const age = Date.now() - new Date(cached.computedAt).getTime()
  return age < CURRENT_WEEK_STALE_MS
}

export async function populateMissingWeeks(
  opts: PopulateMissingWeeksOptions = {}
): Promise<PopulateSummary> {
  const startedAt = Date.now()
  const deadlineMs = opts.deadlineMs
  const invocationEnd =
    deadlineMs !== undefined ? startedAt + deadlineMs : Number.POSITIVE_INFINITY

  if (opts.cli) setPopulateCliMode(true)

  const finalizeResult = await finalizeRecentlyConcludedWeek()

  const weeks = buildPopulateWeekList(opts.filter)
  const cursor = await getPopulateCursor()

  let startIndex = 0
  if (cursor) {
    const idx = weeks.findIndex((w) => w.year === cursor.year && w.week === cursor.week)
    if (idx >= 0) startIndex = idx
  }

  logPopulateStart(weeks.length - startIndex, startIndex)

  let skipped = 0
  let refreshed = 0
  let humioInProgress = false
  const errors: PopulateSummary["errors"] = []
  let pausedEarly = false

  for (let i = startIndex; i < weeks.length; i++) {
    const { year, week } = weeks[i]!

    if (Date.now() >= invocationEnd) {
      await setPopulateCursor({ year, week })
      logPopulate({
        week: weekLabel(year, week),
        action: "pause",
        reason: "deadline",
        resume: true,
      })
      humioInProgress = true
      pausedEarly = true
      break
    }

    if (await shouldSkipPopulateWeek(year, week)) {
      skipped += 1
      logPopulate({ week: weekLabel(year, week), action: "skip", reason: "ready" })
      continue
    }

    logPopulate({
      week: weekLabel(year, week),
      action: "start",
      index: i - startIndex + 1,
      weekCount: weeks.length - startIndex,
    })

    const weekStarted = Date.now()
    const remaining = Math.max(0, invocationEnd - Date.now())
    const source: RefreshSource =
      opts.source === "cli" || opts.source === "http" ? "cron" : (opts.source ?? "cron")

    const resumeCursor = await getPopulateCursor()
    const skipLock =
      resumeCursor?.year === year && resumeCursor?.week === week

    try {
      let result = await refreshWeekProviders(year, week, {
        source,
        deadlineMs: Number.isFinite(invocationEnd) ? remaining : undefined,
        quiet: true,
        skipLock,
        onHumioProgress: opts.cli
          ? (p) => logHumioProgress(year, week, p.phase, p.sliceIndex, p.totalSlices)
          : undefined,
      })

      while (!result.humioComplete && !Number.isFinite(invocationEnd)) {
        result = await refreshWeekProviders(year, week, {
          source,
          quiet: true,
          skipLock: true,
          onHumioProgress: opts.cli
            ? (p) => logHumioProgress(year, week, p.phase, p.sliceIndex, p.totalSlices)
            : undefined,
        })
      }

      while (
        !result.humioComplete &&
        Number.isFinite(invocationEnd) &&
        Date.now() < invocationEnd
      ) {
        const tickRemaining = Math.max(0, invocationEnd - Date.now())
        result = await refreshWeekProviders(year, week, {
          source,
          deadlineMs: tickRemaining,
          quiet: true,
          skipLock: true,
          onHumioProgress: opts.cli
            ? (p) => logHumioProgress(year, week, p.phase, p.sliceIndex, p.totalSlices)
            : undefined,
        })
        if (result.paused) break
      }

      if (result.fastProvidersRefreshed && !opts.cli) {
        logPopulate({
          week: weekLabel(year, week),
          action: "fast",
          providers: ["datadog", "commercetools"],
          ms: result.durationMs,
        })
      }

      if (!result.humioComplete) {
        humioInProgress = true
        pausedEarly = true
        await setPopulateCursor({ year, week })
        logPopulate({
          week: weekLabel(year, week),
          action: "pause",
          reason: "humio",
          resume: true,
          ms: Date.now() - weekStarted,
        })
        break
      }

      refreshed += 1
      logPopulate({
        week: weekLabel(year, week),
        action: "done",
        cacheable: result.cacheable,
        ms: Date.now() - weekStarted,
      })

      if (!result.cacheable) {
        errors.push({
          year,
          week,
          message: `providers failed: ${result.providersFailed.join(", ")}`,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push({ year, week, message })
      logPopulate({
        week: weekLabel(year, week),
        action: "error",
        error: message,
        ms: Date.now() - weekStarted,
      })
    }
  }

  const done = !pausedEarly && !humioInProgress

  if (done) {
    await setPopulateCursor(null)
  }

  const summary: PopulateSummary = {
    done: done && errors.length === 0,
    cursor: humioInProgress ? (await getPopulateCursor()) : null,
    skipped,
    refreshed,
    humioInProgress,
    errors,
    durationMs: Date.now() - startedAt,
    finalizedWeek:
      finalizeResult.finalized && finalizeResult.year !== undefined && finalizeResult.week !== undefined
        ? { year: finalizeResult.year, week: finalizeResult.week }
        : undefined,
  }

  logPopulateSummary(
    { skipped, done: refreshed, paused: humioInProgress ? 1 : 0, errors: errors.length },
    summary.durationMs
  )

  return summary
}

export { METRICS_INVOCATION_BUDGET_MS }
