/** Humio QueryJob slice width for groupBy error breakdown. */
export const HUMIO_SLICE_HOURS = 2

/** Narrower slices for count() queries over high-volume hooks. */
export const HUMIO_SLICE_HOURS_COUNT = 1

/** Max concurrent slice queries within one batch (serial for Humio). */
export const HUMIO_BATCH_SIZE = 1

/** Pause between Humio slice batches (ms). */
export const HUMIO_BATCH_GAP_MS = 500

/** Minimum poll attempts before accepting an empty completed job. */
export const HUMIO_MIN_POLLS_BEFORE_EMPTY = 3

/** Max QueryJob poll attempts before timeout (~2 min per slice). */
export const HUMIO_MAX_POLL_ATTEMPTS = 90

/** Consecutive stable polls required when Humio omits running=false. */
export const HUMIO_STABLE_POLLS_REQUIRED = 2

/** paginationLimit for count() aggregate queries. */
export const HUMIO_COUNT_POLL_LIMIT = 5

/** paginationLimit for errorBreakdown groupBy queries. */
export const HUMIO_GROUPBY_POLL_LIMIT = 500

/** Max in-flight Humio QueryJobs across all callers. */
export const HUMIO_MAX_CONCURRENT_JOBS = 2

/** Skip full-range query when range exceeds this (ms). */
export const HUMIO_FULL_RANGE_MAX_MS = 24 * 60 * 60 * 1000

/** Minimum slice width before giving up on halving (30 min). */
export const HUMIO_MIN_SLICE_MS = 30 * 60 * 1000

/** Slice failure ratio above which reliability is marked failed. */
export const HUMIO_SLICE_FAILURE_THRESHOLD = 0.2
