import "server-only"

import type { DatadogMetrics } from "@/lib/types/metrics"
import { emptyTraffic, emptyWebVitals } from "@/lib/types/health-report"
import { metricsLog } from "@/lib/logging/metrics-logger"
import { fetchTrafficMetrics, fetchWebVitalsMetrics } from "./rum-analytics"
import { fetchPaymentFailureLogs } from "./logs"

export async function fetchDatadogMetrics(
  startISO: string,
  endISO: string
): Promise<DatadogMetrics> {
  const startedAt = Date.now()

  let traffic = emptyTraffic()
  try {
    traffic = await fetchTrafficMetrics(startISO, endISO)
  } catch (error) {
    metricsLog.error("datadog", "Traffic metrics failed", error, { startISO, endISO })
  }

  let web_vitals = emptyWebVitals()
  try {
    web_vitals = await fetchWebVitalsMetrics(startISO, endISO)
  } catch (error) {
    metricsLog.error("datadog", "Web vitals metrics failed", error, { startISO, endISO })
  }

  const payments = await fetchPaymentFailureLogs(startISO, endISO)

  metricsLog.info("datadog", "Metrics completed", {
    total_views: traffic.total_views,
    paymentDeclined: payments.declined,
    paymentApproved: payments.approved,
    durationMs: Date.now() - startedAt,
  })

  return {
    traffic,
    web_vitals,
    payment_failures_declined: payments.declined,
    payment_failures_approved: payments.approved,
  }
}
