import type { HealthReportWeek } from "@/lib/types/health-report"
import type {
  CommercetoolsProviderEntry,
  DatadogProviderEntry,
  HumioProviderEntry,
} from "@/lib/types/provider-cache"
import {
  emptyCustomers,
  emptyEcommerce,
  emptyReliability,
  emptyTraffic,
  emptyWebVitals,
} from "@/lib/types/health-report"

function computeConversionRate(totalOrders: number, totalViews: number): string {
  if (totalViews <= 0) return "0%"
  return `${((totalOrders / totalViews) * 100).toFixed(2)}%`
}

export interface MergeProviderResult {
  report: HealthReportWeek
  cacheable: boolean
  providersFailed: string[]
}

export function mergeProviderCaches(
  year: number,
  week: number,
  providers: {
    datadog: DatadogProviderEntry | null
    commercetools: CommercetoolsProviderEntry | null
    humio: HumioProviderEntry | null
  }
): MergeProviderResult {
  const providersFailed: string[] = []

  const datadog = providers.datadog?.status === "ready" ? providers.datadog.data : null
  const ct = providers.commercetools?.status === "ready" ? providers.commercetools.data : null
  const humio = providers.humio?.status === "ready" ? providers.humio.data : null

  if (!providers.datadog || providers.datadog.status !== "ready") {
    providersFailed.push("datadog")
  }
  if (!providers.commercetools || providers.commercetools.status !== "ready") {
    providersFailed.push("commercetools")
  } else if (providers.commercetools.data.failedModes?.length) {
    providersFailed.push("commercetools")
  }
  if (!providers.humio || providers.humio.status !== "ready") {
    providersFailed.push("humio")
  } else if (providers.humio.data.reliabilityFailed) {
    providersFailed.push("humio")
  }

  const traffic = datadog?.traffic ?? emptyTraffic()
  const web_vitals = datadog?.web_vitals ?? emptyWebVitals()
  const reliability = humio?.reliability ?? emptyReliability()
  const totalOrders = ct?.ecommerce.total_orders ?? 0
  const totalViews = traffic.total_views

  const cacheable =
    providersFailed.length === 0 &&
    datadog !== null &&
    ct !== null &&
    humio !== null &&
    !humio.reliabilityFailed

  return {
    cacheable,
    providersFailed,
    report: {
      week_number: week,
      year,
      computed_at: new Date().toISOString(),
      traffic,
      reliability,
      ecommerce: {
        total_orders: totalOrders,
        active_carts: ct?.ecommerce.active_carts ?? 0,
        payment_failures_declined: Math.max(
          humio?.payment_failures_declined ?? 0,
          datadog?.payment_failures_declined ?? 0
        ),
        payment_failures_approved: Math.max(
          humio?.payment_failures_approved ?? 0,
          datadog?.payment_failures_approved ?? 0
        ),
      },
      customers: {
        ...(ct?.customers ?? emptyCustomers()),
        conversion_rate: computeConversionRate(totalOrders, totalViews),
      },
      web_vitals,
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
