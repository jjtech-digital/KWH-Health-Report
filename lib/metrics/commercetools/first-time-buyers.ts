import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  fetchFirstTimeBuyerEmails,
  fetchLifetimeOrderCountForEmail,
} from "./cart-fetcher"
import {
  CT_EMAIL_BATCH_GAP_MS,
  CT_EMAIL_BATCH_SIZE,
  CT_EMAIL_RETRIES_PER_ITEM,
  CT_FTB_FULL_WEEK_THRESHOLD,
  CT_INTERVAL_HOURS_FTB,
} from "./constants"
import { generateHourlyIntervals } from "./interval-generator"
import { runInBatches } from "./run-in-batches"

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("FIRST_TIME_BUYERS aborted")
  }
}

async function countFirstTimeBuyersFromEmails(
  emails: string[],
  signal?: AbortSignal
): Promise<number> {
  if (emails.length === 0) return 0

  const counts = await runInBatches(
    emails,
    (email) => fetchLifetimeOrderCountForEmail(email, signal),
    {
      batchSize: CT_EMAIL_BATCH_SIZE,
      gapMs: CT_EMAIL_BATCH_GAP_MS,
      retriesPerItem: CT_EMAIL_RETRIES_PER_ITEM,
      label: "FIRST_TIME_BUYERS_email",
      signal,
    }
  )

  return counts.filter((total) => total === 1).length
}

export async function countFirstTimeBuyers(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<number> {
  const emails = await fetchFirstTimeBuyerEmails(from, to)
  return countFirstTimeBuyersFromEmails(emails, signal)
}

export async function countFirstTimeBuyersForWeek(
  startDate: string,
  endDate: string,
  intervalHours?: number,
  options?: { signal?: AbortSignal }
): Promise<number> {
  const signal = options?.signal
  throwIfAborted(signal)

  const emails = await fetchFirstTimeBuyerEmails(startDate, endDate)
  if (emails.length === 0) return 0

  const hours = intervalHours ?? CT_INTERVAL_HOURS_FTB

  if (emails.length <= CT_FTB_FULL_WEEK_THRESHOLD) {
    metricsLog.info("commercetools", "FTB full-week path", {
      emailCount: emails.length,
      threshold: CT_FTB_FULL_WEEK_THRESHOLD,
    })
    return countFirstTimeBuyersFromEmails(emails, signal)
  }

  metricsLog.info("commercetools", "FTB interval path", {
    emailCount: emails.length,
    threshold: CT_FTB_FULL_WEEK_THRESHOLD,
    intervalHours: hours,
  })

  const intervals = generateHourlyIntervals(startDate, endDate, hours)
  let total = 0

  for (const interval of intervals) {
    throwIfAborted(signal)
    total += await countFirstTimeBuyers(interval.from, interval.to, signal)
  }

  return total
}

export async function fetchFirstTimeBuyersForInterval(
  from: string,
  to: string
): Promise<number> {
  return countFirstTimeBuyers(from, to)
}
