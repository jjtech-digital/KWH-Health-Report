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

  const [trafficResult, vitalsResult, paymentsResult] = await Promise.allSettled([
    fetchTrafficMetrics(startISO, endISO),
    fetchWebVitalsMetrics(startISO, endISO),
    fetchPaymentFailureLogs(startISO, endISO),
  ])

  let traffic = emptyTraffic()
  if (trafficResult.status === "fulfilled") {
    traffic = trafficResult.value
  } else {
    metricsLog.error("datadog", "Traffic metrics failed", trafficResult.reason, {
      startISO,
      endISO,
    })
  }

  let web_vitals = emptyWebVitals()
  if (vitalsResult.status === "fulfilled") {
    web_vitals = vitalsResult.value
  } else {
    metricsLog.error("datadog", "Web vitals metrics failed", vitalsResult.reason, {
      startISO,
      endISO,
    })
  }

  const payments =
    paymentsResult.status === "fulfilled"
      ? paymentsResult.value
      : { declined: 0, approved: 0 }

  if (paymentsResult.status === "rejected") {
    metricsLog.error("datadog", "Payment logs failed", paymentsResult.reason, {
      startISO,
      endISO,
    })
  }

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
