import "server-only"

import { getReportCache } from "@/lib/cache"
import {
  deleteHumioCheckpoint,
  getAllProviderCaches,
  getHumioCheckpoint,
  isProviderReady,
  setHumioCheckpoint,
  setProviderCache,
} from "@/lib/cache/provider-cache"
import {
  acquireRefreshLock,
  releaseRefreshLock,
  touchRefreshLock,
} from "@/lib/cache/refresh-lock"
import { logPopulateCli, logProviderComplete } from "@/lib/logging/populate-logger"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { fetchCommercetoolsMetrics } from "@/lib/metrics/commercetools"
import { fetchDatadogMetrics } from "@/lib/metrics/datadog"
import {
  fetchHumioMetricsCheckpointed,
  type HumioCheckpointProgress,
} from "@/lib/metrics/humio/checkpoint"
import type { RefreshSource } from "@/lib/types/cache"
import { getWeekDateRangeISO, isWeekConcluded } from "@/lib/weeks"
import { persistWeekSnapshot } from "@/lib/data/week-json-store"
import { mergeProviderCaches } from "./merge-provider-caches"

export interface RefreshWeekProvidersResult {
  cacheable: boolean
  providersFailed: string[]
  humioComplete: boolean
  fastProvidersRefreshed: boolean
  paused: boolean
  durationMs: number
}

async function writeMergedWeekCache(
  year: number,
  week: number,
  source: RefreshSource
): Promise<ReturnType<typeof mergeProviderCaches>> {
  const providers = await getAllProviderCaches(year, week)
  const merged = mergeProviderCaches(year, week, providers)
  const concluded = isWeekConcluded(year, week)
  const cache = getReportCache()

  await cache.set(year, week, {
    report: merged.report,
    computedAt: merged.report.computed_at,
    status: "ready",
    finalized: concluded,
    cacheable: merged.cacheable,
    refreshedBy: source,
  })

  if (concluded && merged.cacheable) {
    await persistWeekSnapshot(year, week, merged.report)
  }

  return merged
}

const EMPTY_CT_DATA = {
  ecommerce: { total_orders: 0, active_carts: 0 },
  customers: {
    first_time_buyers: 0,
    returning_customers: 0,
    guest_checkouts: 0,
    registered_user_orders: 0,
    total_registered_users: 0,
  },
}

export async function refreshWeekProviders(
  year: number,
  week: number,
  opts: {
    source: RefreshSource
    force?: boolean
    deadlineMs?: number
    quiet?: boolean
    skipLock?: boolean
    onHumioProgress?: (progress: HumioCheckpointProgress) => void
  }
): Promise<RefreshWeekProvidersResult> {
  const startedAt = Date.now()
  const { startISO, endISO } = getWeekDateRangeISO(year, week)
  const startMs = new Date(startISO).getTime()
  const endMs = new Date(endISO).getTime()

  const invocationDeadline =
    opts.deadlineMs !== undefined
      ? Date.now() + opts.deadlineMs
      : Number.POSITIVE_INFINITY

  let lockHeld = false

  if (!opts.skipLock) {
    const lock = await acquireRefreshLock(year, week, opts.source)
    if (!lock.acquired) {
      return {
        cacheable: false,
        providersFailed: [],
        humioComplete: false,
        fastProvidersRefreshed: false,
        paused: true,
        durationMs: Date.now() - startedAt,
      }
    }
    lockHeld = true
  }

  try {
    const existing = await getAllProviderCaches(year, week)

    const needsDatadog = opts.force || !isProviderReady(existing.datadog)
    const needsCt = opts.force || !isProviderReady(existing.commercetools)
    const needsHumio = opts.force || !isProviderReady(existing.humio)

    if (!needsDatadog && !needsCt && !needsHumio) {
      const merged = await writeMergedWeekCache(year, week, opts.source)
      return {
        cacheable: merged.cacheable,
        providersFailed: merged.providersFailed,
        humioComplete: true,
        fastProvidersRefreshed: false,
        paused: false,
        durationMs: Date.now() - startedAt,
      }
    }

    if (opts.onHumioProgress) {
      logPopulateCli(`${year}-w${week} all providers fetching…`)
    }

    const checkpoint = needsHumio ? await getHumioCheckpoint(year, week) : null
    const weekLabel = `${year}-w${week}`

    const datadogTask = async (): Promise<"skipped" | "ready" | "error"> => {
      if (!needsDatadog) return "skipped"

      const taskStarted = Date.now()
      try {
        const data = await fetchDatadogMetrics(startISO, endISO)
        await setProviderCache(year, week, "datadog", {
          data,
          computedAt: new Date().toISOString(),
          status: "ready",
        })
        if (opts.onHumioProgress) {
          logProviderComplete(weekLabel, "datadog", Date.now() - taskStarted)
        }
        return "ready"
      } catch (error) {
        if (!opts.quiet) {
          metricsLog.error("assembler", "Datadog metrics failed", error)
        }
        if (opts.onHumioProgress) {
          logProviderComplete(weekLabel, "datadog failed", Date.now() - taskStarted)
        }
        return "error"
      }
    }

    const commercetoolsTask = async (): Promise<"skipped" | "ready" | "error"> => {
      if (!needsCt) return "skipped"

      const taskStarted = Date.now()
      try {
        const data = await fetchCommercetoolsMetrics(startISO, endISO)
        await setProviderCache(year, week, "commercetools", {
          data,
          computedAt: new Date().toISOString(),
          status: "ready",
        })
        if (opts.onHumioProgress) {
          logProviderComplete(weekLabel, "commercetools", Date.now() - taskStarted)
        }
        return "ready"
      } catch (error) {
        await setProviderCache(year, week, "commercetools", {
          data: existing.commercetools?.data ?? EMPTY_CT_DATA,
          computedAt: new Date().toISOString(),
          status: "error",
        })
        if (!opts.quiet) {
          metricsLog.error("assembler", "Commercetools metrics failed", error)
        }
        if (opts.onHumioProgress) {
          logProviderComplete(weekLabel, "commercetools failed", Date.now() - taskStarted)
        }
        return "error"
      }
    }

    const humioTask = async (): Promise<
      "skipped" | "complete" | "paused" | "incomplete"
    > => {
      if (!needsHumio) return "skipped"

      const taskStarted = Date.now()
      const humioResult = await fetchHumioMetricsCheckpointed(
        startMs,
        endMs,
        checkpoint,
        {
          deadlineMs: invocationDeadline,
          onSliceProgress: opts.onHumioProgress,
        }
      )

      if (humioResult.paused && humioResult.checkpoint) {
        await setHumioCheckpoint(year, week, humioResult.checkpoint)
        await touchRefreshLock(year, week)
        if (opts.onHumioProgress) {
          logProviderComplete(weekLabel, "humio paused", Date.now() - taskStarted)
        }
        return "paused"
      }

      if (humioResult.complete && humioResult.metrics) {
        await setProviderCache(year, week, "humio", {
          data: humioResult.metrics,
          computedAt: new Date().toISOString(),
          status: humioResult.metrics.reliabilityFailed ? "error" : "ready",
        })
        await deleteHumioCheckpoint(year, week)
        if (opts.onHumioProgress) {
          logProviderComplete(weekLabel, "humio", Date.now() - taskStarted)
        }
        return "complete"
      }

      await deleteHumioCheckpoint(year, week)
      if (opts.onHumioProgress) {
        logProviderComplete(weekLabel, "humio incomplete", Date.now() - taskStarted)
      }
      return "incomplete"
    }

    const providersStarted = Date.now()
    const [datadogOutcome, ctOutcome, humioOutcome] = await Promise.all([
      datadogTask(),
      commercetoolsTask(),
      humioTask(),
    ])

    await writeMergedWeekCache(year, week, opts.source)

    const fastProvidersRefreshed = needsDatadog || needsCt

    if (!opts.quiet && fastProvidersRefreshed) {
      metricsLog.info("assembler", "Providers refreshed in parallel", {
        year,
        week,
        datadog: datadogOutcome,
        commercetools: ctOutcome,
        humio: humioOutcome,
        durationMs: Date.now() - providersStarted,
      })
    }

    if (humioOutcome === "paused") {
      return {
        cacheable: false,
        providersFailed: ["humio"],
        humioComplete: false,
        fastProvidersRefreshed,
        paused: true,
        durationMs: Date.now() - startedAt,
      }
    }

    const merged = await getAllProviderCaches(year, week).then((providers) =>
      mergeProviderCaches(year, week, providers)
    )

    return {
      cacheable: merged.cacheable,
      providersFailed: merged.providersFailed,
      humioComplete: humioOutcome === "complete" || humioOutcome === "skipped",
      fastProvidersRefreshed,
      paused: false,
      durationMs: Date.now() - startedAt,
    }
  } finally {
    if (lockHeld) {
      await releaseRefreshLock(year, week)
    }
  }
}
