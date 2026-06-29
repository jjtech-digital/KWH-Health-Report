import "server-only"

import { countHumioEvents } from "./client"
import { HUMIO_QUERIES } from "./queries"
import { metricsLog } from "@/lib/logging/metrics-logger"

export async function parsePaymentFailures(
  startMs: number,
  endMs: number
): Promise<{ declined: number; approved: number }> {
  const [declinedResult, approvedResult] = await Promise.allSettled([
    countHumioEvents(HUMIO_QUERIES.paymentDeclined, startMs, endMs),
    countHumioEvents(HUMIO_QUERIES.paymentApprovedFailure, startMs, endMs),
  ])

  const declined = declinedResult.status === "fulfilled" ? declinedResult.value : 0
  const approved = approvedResult.status === "fulfilled" ? approvedResult.value : 0

  if (declinedResult.status === "rejected") {
    metricsLog.error("humio", "Payment declined count failed", declinedResult.reason)
  }

  if (approvedResult.status === "rejected") {
    metricsLog.error("humio", "Payment approved failure count failed", approvedResult.reason)
  }

  return { declined, approved }
}
