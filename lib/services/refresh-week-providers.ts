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
import {
  METRICS_CT_TIMEOUT_MS,
  METRICS_INVOCATION_BUDGET_MS,
} from "@/lib/config/metrics-timeouts"
import { logPopulateCli } from "@/lib/logging/populate-logger"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { fetchCommercetoolsMetrics } from "@/lib/metrics/commercetools"
import { fetchDatadogMetrics } from "@/lib/metrics/datadog"
import { fetchHumioMetricsCheckpointed, type HumioCheckpointProgress } from "@/lib/metrics/humio/checkpoint"
import type { RefreshSource } from "@/lib/types/cache"
import { getWeekDateRangeISO, isWeekConcluded } from "@/lib/weeks"
import { persistWeekSnapshot } from "@/lib/data/week-json-store"
import { mergeProviderCaches } from "./merge-provider-caches"

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

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
    let fastProvidersRefreshed = false

    const needsDatadog = opts.force || !isProviderReady(existing.datadog)
    const needsCt = opts.force || !isProviderReady(existing.commercetools)

    if (needsDatadog || needsCt) {
      const fastStarted = Date.now()
      if (opts.onHumioProgress) {
        logPopulateCli(`${year}-w${week} datadog+ct fetching…`)
      }
      const remainingForFast = Math.max(invocationDeadline - Date.now(), 5_000)

      const [ddResult, ctResult] = await Promise.allSettled([
        needsDatadog
          ? fetchDatadogMetrics(startISO, endISO)
          : Promise.resolve(existing.datadog!.data),
        needsCt
          ? withTimeout(
              fetchCommercetoolsMetrics(startISO, endISO),
              Math.min(METRICS_CT_TIMEOUT_MS, remainingForFast),
              "commercetools"
            )
          : Promise.resolve(existing.commercetools!.data),
      ])

      const now = new Date().toISOString()

      if (needsDatadog) {
        if (ddResult.status === "fulfilled") {
          await setProviderCache(year, week, "datadog", {
            data: ddResult.value,
            computedAt: now,
            status: "ready",
          })
        } else if (!opts.quiet) {
          metricsLog.error("assembler", "Datadog metrics failed", ddResult.reason)
        }
      }

      if (needsCt) {
        if (ctResult.status === "fulfilled") {
          await setProviderCache(year, week, "commercetools", {
            data: ctResult.value,
            computedAt: now,
            status: "ready",
          })
        } else {
          await setProviderCache(year, week, "commercetools", {
            data: existing.commercetools?.data ?? {
              ecommerce: { total_orders: 0, active_carts: 0 },
              customers: {
                first_time_buyers: 0,
                returning_customers: 0,
                guest_checkouts: 0,
                registered_user_orders: 0,
                total_registered_users: 0,
              },
            },
            computedAt: now,
            status: "error",
          })
          if (!opts.quiet) {
            metricsLog.error("assembler", "Commercetools metrics failed", ctResult.reason)
          }
        }
      }

      await writeMergedWeekCache(year, week, opts.source)
      fastProvidersRefreshed = true

      if (opts.onHumioProgress) {
        logPopulateCli(
          `${year}-w${week} datadog+ct ${Math.round((Date.now() - fastStarted) / 1000)}s`
        )
      }

      if (!opts.quiet) {
        metricsLog.info("assembler", "Fast providers refreshed", {
          year,
          week,
          durationMs: Date.now() - fastStarted,
        })
      }
    }

    const humioExisting = (await getAllProviderCaches(year, week)).humio
    if (!opts.force && isProviderReady(humioExisting)) {
      const merged = await writeMergedWeekCache(year, week, opts.source)
      return {
        cacheable: merged.cacheable,
        providersFailed: merged.providersFailed,
        humioComplete: true,
        fastProvidersRefreshed,
        paused: false,
        durationMs: Date.now() - startedAt,
      }
    }

    const checkpoint = await getHumioCheckpoint(year, week)
    if (opts.onHumioProgress) {
      logPopulateCli(`${year}-w${week} humio starting`)
    }

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
      await writeMergedWeekCache(year, week, opts.source)

      return {
        cacheable: false,
        providersFailed: ["humio"],
        humioComplete: false,
        fastProvidersRefreshed,
        paused: true,
        durationMs: Date.now() - startedAt,
      }
    }

    if (humioResult.complete && humioResult.metrics) {
      const now = new Date().toISOString()
      await setProviderCache(year, week, "humio", {
        data: humioResult.metrics,
        computedAt: now,
        status: humioResult.metrics.reliabilityFailed ? "error" : "ready",
      })
      await deleteHumioCheckpoint(year, week)
      const merged = await writeMergedWeekCache(year, week, opts.source)

      return {
        cacheable: merged.cacheable,
        providersFailed: merged.providersFailed,
        humioComplete: true,
        fastProvidersRefreshed,
        paused: false,
        durationMs: Date.now() - startedAt,
      }
    }

    await deleteHumioCheckpoint(year, week)
    const merged = await writeMergedWeekCache(year, week, opts.source)

    return {
      cacheable: merged.cacheable,
      providersFailed: merged.providersFailed,
      humioComplete: false,
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
