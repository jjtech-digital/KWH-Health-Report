/** CT GraphQL `total` is unreliable above this (platform cap). */
export const CT_MAX_QUERY_TOTAL = 10_000

/** Max concurrent GraphQL calls within one batch. */
export const CT_BATCH_SIZE = 15

/** Per-email lifetime lookups — lower concurrency to avoid connect exhaustion. */
export const CT_EMAIL_BATCH_SIZE = 3

/** Pause between batches (ms) — reduces ETIMEDOUT / connection exhaustion. */
export const CT_BATCH_GAP_MS = 1_000

/** Shorter gap between per-email batches. */
export const CT_EMAIL_BATCH_GAP_MS = 500

/** Per-request fetch timeout (ms). */
export const CT_FETCH_TIMEOUT_MS = 30_000

/** Max retries for transient GraphQL / network failures. */
export const CT_MAX_RETRIES = 3

/** Base delay for exponential backoff between retries (ms). */
export const CT_RETRY_BASE_MS = 1_000

/** Max in-flight GraphQL calls across all CT metrics. */
export const CT_MAX_CONCURRENT_JOBS = 4

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
