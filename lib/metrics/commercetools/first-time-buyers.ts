import "server-only"

import {
  fetchFirstTimeBuyerEmails,
  fetchLifetimeOrderCountForEmail,
} from "./cart-fetcher"
import {
  CT_EMAIL_BATCH_GAP_MS,
  CT_EMAIL_BATCH_SIZE,
  CT_EMAIL_RETRIES_PER_ITEM,
} from "./constants"
import { runInBatches } from "./run-in-batches"

export async function countFirstTimeBuyers(from: string, to: string): Promise<number> {
  const emails = await fetchFirstTimeBuyerEmails(from, to)
  if (emails.length === 0) return 0

  const counts = await runInBatches(
    emails,
    (email) => fetchLifetimeOrderCountForEmail(email),
    {
      batchSize: CT_EMAIL_BATCH_SIZE,
      gapMs: CT_EMAIL_BATCH_GAP_MS,
      retriesPerItem: CT_EMAIL_RETRIES_PER_ITEM,
      label: "FIRST_TIME_BUYERS_email",
    }
  )

  return counts.filter((total) => total === 1).length
}

/** Full-week pass — paginated order fetch handles volume; avoids 42× interval N+1 bursts. */
export async function countFirstTimeBuyersForWeek(
  startDate: string,
  endDate: string,
  _intervalHours?: number
): Promise<number> {
  return countFirstTimeBuyers(startDate, endDate)
}

export async function fetchFirstTimeBuyersForInterval(
  from: string,
  to: string
): Promise<number> {
  return countFirstTimeBuyers(from, to)
}
