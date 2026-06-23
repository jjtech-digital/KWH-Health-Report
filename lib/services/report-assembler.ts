import "server-only"

import type { HealthReportWeek } from "@/lib/types/health-report"
import type { CommercetoolsMetrics, DatadogMetrics, HumioMetrics } from "@/lib/types/metrics"
import {
  emptyCustomers,
  emptyEcommerce,
  emptyReliability,
  emptyTraffic,
  emptyWebVitals,
} from "@/lib/types/health-report"
import { getWeekDateRangeISO } from "@/lib/weeks"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { fetchCommercetoolsMetrics } from "@/lib/metrics/commercetools"
import { fetchHumioMetrics } from "@/lib/metrics/humio"
import { fetchDatadogMetrics } from "@/lib/metrics/datadog"

function computeConversionRate(totalOrders: number, totalViews: number): string {
  if (totalViews <= 0) return "0%"
  return `${((totalOrders / totalViews) * 100).toFixed(2)}%`
}

const PROVIDER_FETCH_TIMEOUT_MS = 120_000

function withProviderTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${PROVIDER_FETCH_TIMEOUT_MS}ms`)),
        PROVIDER_FETCH_TIMEOUT_MS
      )
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export interface AssembledWeekReport {
  report: HealthReportWeek
  cacheable: boolean
  providersFailed: string[]
}

export async function assembleWeekReport(
  year: number,
  week: number
): Promise<AssembledWeekReport> {
  const { startISO, endISO } = getWeekDateRangeISO(year, week)
  const startedAt = Date.now()

  metricsLog.info("assembler", "Week report assembly started", {
    year,
    week,
    startISO,
    endISO,
  })

  const [ctResult, humioResult, datadogResult] = await Promise.allSettled([
    withProviderTimeout(fetchCommercetoolsMetrics(startISO, endISO), "commercetools"),
    withProviderTimeout(fetchHumioMetrics(startISO, endISO), "humio"),
    fetchDatadogMetrics(startISO, endISO),
  ])

  const providersFailed: string[] = []

  const emptyCt: CommercetoolsMetrics = {
    ecommerce: { total_orders: 0, active_carts: 0 },
    customers: emptyCustomers(),
  }

  let ct: CommercetoolsMetrics = emptyCt
  if (ctResult.status === "fulfilled") {
    ct = ctResult.value
    if (ct.failedModes && ct.failedModes.length > 0) {
      providersFailed.push("commercetools")
      metricsLog.warn("assembler", "Commercetools partial failure", {
        failedModes: ct.failedModes,
      })
    }
  } else {
    providersFailed.push("commercetools")
    metricsLog.error("assembler", "Commercetools metrics failed", ctResult.reason)
  }

  const emptyHumio: HumioMetrics = {
    reliability: emptyReliability(),
    payment_failures_declined: 0,
    payment_failures_approved: 0,
    reliabilityFailed: true,
  }

  let humio: HumioMetrics = emptyHumio
  if (humioResult.status === "fulfilled") {
    humio = humioResult.value
    if (humio.reliabilityFailed) {
      providersFailed.push("humio")
    }
  } else {
    providersFailed.push("humio")
    metricsLog.error("assembler", "Humio metrics failed", humioResult.reason)
  }

  const emptyDatadog: DatadogMetrics = {
    traffic: emptyTraffic(),
    web_vitals: emptyWebVitals(),
    payment_failures_declined: 0,
    payment_failures_approved: 0,
  }

  let datadog: DatadogMetrics = emptyDatadog
  if (datadogResult.status === "fulfilled") {
    datadog = datadogResult.value
  } else {
    providersFailed.push("datadog")
    metricsLog.error("assembler", "Datadog metrics failed", datadogResult.reason)
  }

  const totalOrders = ct.ecommerce.total_orders
  const totalViews = datadog.traffic.total_views
  const cacheable = !humio.reliabilityFailed && providersFailed.length === 0

  metricsLog.info("assembler", "Week report assembled", {
    year,
    week,
    total_views: totalViews,
    failed_requests: humio.reliability.failed_requests,
    total_orders: totalOrders,
    lcp_mobile: datadog.web_vitals.mobile.lcp,
    lcp_desktop: datadog.web_vitals.desktop.lcp,
    durationMs: Date.now() - startedAt,
    providersFailed,
    cacheable,
  })

  if (totalViews === 0) {
    metricsLog.warn("assembler", "Datadog traffic is zero", { year, week })
  }
  if (humio.reliability.failed_requests === 0 && humio.reliability.error_rate === "0%") {
    metricsLog.warn("assembler", "Humio reliability is zero", { year, week })
  }
  if (
    datadog.web_vitals.mobile.lcp === "0s" &&
    datadog.web_vitals.desktop.lcp === "0s"
  ) {
    metricsLog.warn("assembler", "Datadog web vitals appear empty", { year, week })
  }

  return {
    cacheable,
    providersFailed,
    report: {
      week_number: week,
      year,
      computed_at: new Date().toISOString(),
      traffic: datadog.traffic,
      reliability: humio.reliability,
      ecommerce: {
        total_orders: totalOrders,
        active_carts: ct.ecommerce.active_carts,
        payment_failures_declined: Math.max(
          humio.payment_failures_declined,
          datadog.payment_failures_declined
        ),
        payment_failures_approved: Math.max(
          humio.payment_failures_approved,
          datadog.payment_failures_approved
        ),
      },
      customers: {
        ...ct.customers,
        conversion_rate: computeConversionRate(totalOrders, totalViews),
      },
      web_vitals: datadog.web_vitals,
    },
  }
}

export function emptyHealthReportWeek(year: number, week: number): HealthReportWeek {
  return {
    week_number: week,
    year,
    computed_at: new Date().toISOString(),
    traffic: emptyTraffic(),
    reliability: emptyReliability(),
    ecommerce: emptyEcommerce(),
    customers: emptyCustomers(),
    web_vitals: emptyWebVitals(),
  }
}
