import "server-only"

interface DatadogEnv {
  apiKey: string
  appKey: string
  baseUrl: string
}

export const DD_MAX_RETRIES = 3
export const DD_RETRY_BASE_MS = 1_000

const RETRYABLE_STATUS = new Set([429, 503])

function truncateBody(text: string, maxLen = 300): string {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10)
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000
    }
  }
  return DD_RETRY_BASE_MS * 2 ** attempt
}

export function getDatadogEnv(): DatadogEnv {
  const apiKey = process.env.DATADOG_API_KEY
  const appKey = process.env.DATADOG_APPLICATION_KEY
  const baseUrl = process.env.DATADOG_BASE_URL ?? "https://ap1.datadoghq.com"

  if (!apiKey || !appKey) {
    throw new Error("Missing DATADOG_API_KEY or DATADOG_APPLICATION_KEY")
  }

  return { apiKey, appKey, baseUrl }
}

export function rumBaseQuery(): string {
  return process.env.DATADOG_RUM_QUERY ?? "@type:view env:prod"
}

export function isDatadogRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /\bfailed: 429\b/.test(error.message)
}

export async function datadogFetch<T>(
  path: string,
  init: RequestInit & { body?: string }
): Promise<T> {
  const { apiKey, appKey, baseUrl } = getDatadogEnv()

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= DD_MAX_RETRIES; attempt++) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "DD-API-KEY": apiKey,
        "DD-APPLICATION-KEY": appKey,
        "Content-Type": "application/json",
        ...init.headers,
      },
    })

    if (res.ok) {
      return res.json() as Promise<T>
    }

    const text = await res.text()
    const shortBody = truncateBody(text)
    lastError = new Error(`Datadog API ${path} failed: ${res.status} ${shortBody}`)

    if (!RETRYABLE_STATUS.has(res.status) || attempt === DD_MAX_RETRIES) {
      throw lastError
    }

    const delayMs = retryDelayMs(attempt, res.headers.get("Retry-After"))
    await sleep(delayMs)
  }

  throw lastError ?? new Error(`Datadog API ${path} failed`)
}
