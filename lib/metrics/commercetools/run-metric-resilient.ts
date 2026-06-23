import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import { METRICS_CT_FTB_TIMEOUT_MS } from "@/lib/config/commercetools"
import {
  CT_METRIC_MAX_RETRIES,
  CT_METRIC_RETRY_BASE_MS,
} from "./constants"
import { isCtTimeoutError, isTransientCtError } from "./ct-errors"
import { runMetric, type MetricMode } from "./run-metric"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function metricRetryDelayMs(attempt: number): number {
  return CT_METRIC_RETRY_BASE_MS * 2 ** attempt
}

function shouldRetryMetric(error: unknown, attempt: number): boolean {
  if (isCtTimeoutError(error)) {
    return false
  }
  return isTransientCtError(error) && attempt < CT_METRIC_MAX_RETRIES
}

async function runMetricWithTimeout(
  mode: MetricMode,
  startISO: string,
  endISO: string,
  timeoutMs: number
): Promise<number> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      runMetric(mode, startISO, endISO, { signal: controller.signal }),
      new Promise<number>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error(`${mode} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function runMetricResilient(
  mode: MetricMode,
  startISO: string,
  endISO: string,
  options?: { timeoutMs?: number }
): Promise<number> {
  const timeoutMs = options?.timeoutMs
  let attempt = 0

  while (true) {
    try {
      if (timeoutMs !== undefined) {
        return await runMetricWithTimeout(mode, startISO, endISO, timeoutMs)
      }
      return await runMetric(mode, startISO, endISO)
    } catch (error) {
      if (!shouldRetryMetric(error, attempt)) {
        throw error
      }

      const delayMs = metricRetryDelayMs(attempt)
      metricsLog.warn("commercetools", "Metric retry scheduled", {
        mode,
        attempt: attempt + 1,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      })
      await sleep(delayMs)
      attempt += 1
    }
  }
}

/** FIRST_TIME_BUYERS uses a dedicated longer budget — slowest mode. */
export const CT_FTB_TIMEOUT_MS = METRICS_CT_FTB_TIMEOUT_MS
