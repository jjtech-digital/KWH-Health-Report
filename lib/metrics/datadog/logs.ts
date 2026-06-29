import "server-only"

import { datadogFetch, isDatadogRateLimitError } from "./client"
import { metricsLog } from "@/lib/logging/metrics-logger"

interface DatadogLogsResponse {
  logs?: Array<{ content?: { message?: string } }>
}

function toEpochMs(iso: string): string {
  return String(new Date(iso).getTime())
}

async function countLogs(query: string, startISO: string, endISO: string): Promise<number> {
  const body = {
    query,
    time: { from: toEpochMs(startISO), to: toEpochMs(endISO) },
    limit: 1000,
  }

  const res = await datadogFetch<DatadogLogsResponse>("/api/v1/logs-queries/list", {
    method: "POST",
    body: JSON.stringify(body),
  })

  return res.logs?.length ?? 0
}

export async function fetchPaymentFailureLogs(
  startISO: string,
  endISO: string
): Promise<{ declined: number; approved: number }> {
  try {
    const declined = await countLogs(
      "dispatch order terminated as risk assessment failed",
      startISO,
      endISO
    )
    const approved = await countLogs(
      "Risk assessment completed old_status declined",
      startISO,
      endISO
    )

    return { declined, approved }
  } catch (error) {
    if (isDatadogRateLimitError(error)) {
      metricsLog.warn("datadog", "Payment failure log query rate limited", {
        status: 429,
        startISO,
        endISO,
      })
    } else {
      metricsLog.error("datadog", "Payment failure log query failed", error, {
        startISO,
        endISO,
      })
    }
    return { declined: 0, approved: 0 }
  }
}
