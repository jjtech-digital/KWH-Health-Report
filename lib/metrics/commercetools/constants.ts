/** CT GraphQL `total` is unreliable above this (platform cap). */
export const CT_MAX_QUERY_TOTAL = 10_000

export {
  CT_BATCH_GAP_MS,
  CT_BATCH_SIZE,
  CT_EMAIL_BATCH_GAP_MS,
  CT_EMAIL_BATCH_SIZE,
  CT_FETCH_TIMEOUT_MS,
  CT_FTB_FULL_WEEK_THRESHOLD,
  CT_MAX_CONCURRENT_JOBS,
  METRICS_CT_FTB_TIMEOUT_MS,
} from "@/lib/config/commercetools"

/** Max retries for transient GraphQL / network failures. */
export const CT_MAX_RETRIES = 3

/** Base delay for exponential backoff between retries (ms). */
export const CT_RETRY_BASE_MS = 1_000

/** When a range hits the cap, bisect sub-ranges this many minutes at a time. */
export const CT_BISECT_MINUTES = 30

/** Default interval step when splitting a week after cap hit. */
export const CT_INTERVAL_HOURS_CART = 1
export const CT_INTERVAL_HOURS_ORDERS = 1
export const CT_INTERVAL_HOURS_FTB = 4

/** Per-item retries inside runInBatches (e.g. email lifetime lookups). */
export const CT_EMAIL_RETRIES_PER_ITEM = 4

/** Metric-level retries after a mode fails (transient / timeout). */
export const CT_METRIC_MAX_RETRIES = 3

/** Base delay for metric-level exponential backoff (ms). */
export const CT_METRIC_RETRY_BASE_MS = 2_000
