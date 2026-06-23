function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === "") return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Max concurrent GraphQL calls within one batch. */
export const CT_BATCH_SIZE = parseEnvInt("CT_BATCH_SIZE", 15)

/** Per-email lifetime lookups — lower concurrency avoids connect exhaustion. */
export const CT_EMAIL_BATCH_SIZE = parseEnvInt("CT_EMAIL_BATCH_SIZE", 5)

/** Pause between batches (ms). */
export const CT_BATCH_GAP_MS = parseEnvInt("CT_BATCH_GAP_MS", 1_000)

/** Shorter gap between per-email batches. */
export const CT_EMAIL_BATCH_GAP_MS = parseEnvInt("CT_EMAIL_BATCH_GAP_MS", 500)

/** Per-request fetch timeout (ms). */
export const CT_FETCH_TIMEOUT_MS = parseEnvInt("CT_FETCH_TIMEOUT_MS", 30_000)

/** Max in-flight GraphQL calls across all CT metrics. */
export const CT_MAX_CONCURRENT_JOBS = parseEnvInt("CT_MAX_CONCURRENT_JOBS", 4)

/** Dedicated FIRST_TIME_BUYERS mode budget (ms). */
export const METRICS_CT_FTB_TIMEOUT_MS = parseEnvInt("METRICS_CT_FTB_TIMEOUT_MS", 600_000)

/** Above this unique-email count, FTB uses 4-hour interval splitting instead of full-week lookups. */
export const CT_FTB_FULL_WEEK_THRESHOLD = parseEnvInt("CT_FTB_FULL_WEEK_THRESHOLD", 400)
