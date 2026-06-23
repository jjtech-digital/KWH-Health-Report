import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import {
  CT_FETCH_TIMEOUT_MS,
  CT_MAX_RETRIES,
  CT_RETRY_BASE_MS,
} from "./constants"
import { withCtQuerySlot } from "./query-semaphore"

interface TokenResponse {
  access_token: string
  expires_in: number
}

interface CtEnv {
  projectKey: string
  clientId: string
  clientSecret: string
  authUrl: string
  apiUrl: string
}

export interface ExecuteGraphQLOptions {
  /** Short label for aggregated error logs (e.g. FIRST_TIME_BUYERS_email). */
  label?: string
}

let tokenCache: { token: string; expiresAt: number } | null = null

function getCtEnv(): CtEnv {
  const projectKey = process.env.CT_PROJECT_KEY
  const clientId = process.env.CT_CLIENT_ID
  const clientSecret = process.env.CT_CLIENT_SECRET
  const authUrl = process.env.CT_AUTH_URL
  const apiUrl = process.env.CT_API_URL

  if (!projectKey || !clientId || !clientSecret || !authUrl || !apiUrl) {
    throw new Error("Missing required Commercetools environment variables")
  }

  return { projectKey, clientId, clientSecret, authUrl, apiUrl }
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
  return CT_RETRY_BASE_MS * 2 ** attempt
}

function isTransientCtError(error: unknown, status?: number): boolean {
  if (status !== undefined && (status === 429 || status === 503)) {
    return true
  }

  if (!(error instanceof Error)) return false

  const message = error.message
  const cause = error.cause

  if (message.includes("fetch failed")) return true
  if (message.includes("Connect Timeout")) return true
  if (message.includes("UND_ERR_CONNECT_TIMEOUT")) return true
  if (message.includes("ETIMEDOUT")) return true
  if (message.includes("ECONNRESET")) return true
  if (message.includes("EAI_AGAIN")) return true
  if (message.includes("AbortError")) return true
  if (message.includes("timed out")) return true

  if (cause instanceof Error) {
    const causeMessage = cause.message
    const causeCode =
      "code" in cause && typeof cause.code === "string" ? cause.code : ""
    if (causeCode === "UND_ERR_CONNECT_TIMEOUT") return true
    if (causeMessage.includes("Connect Timeout")) return true
    if (causeMessage.includes("ETIMEDOUT")) return true
  }

  return false
}

function formatCtError(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error ? ` (${error.cause.message})` : ""
    return `${error.message}${cause}`
  }
  return String(error)
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token
  }

  const { clientId, clientSecret, authUrl } = getCtEnv()

  const res = await fetch(`${authUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(CT_FETCH_TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`Failed to get Commercetools access token: ${res.status}`)
  }

  const data = (await res.json()) as TokenResponse
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }

  metricsLog.info("commercetools", "Token refreshed", {
    expiresInSeconds: data.expires_in,
  })

  return tokenCache.token
}

async function executeGraphQLInner<T>(
  query: string,
  token: string,
  projectKey: string,
  apiUrl: string
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= CT_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${apiUrl}/${projectKey}/graphql`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(CT_FETCH_TIMEOUT_MS),
      })

      if (!res.ok) {
        const errorText = await res.text()
        lastError = new Error(
          `Commercetools GraphQL request failed: ${res.status} ${errorText}`
        )

        if (!isTransientCtError(lastError, res.status) || attempt === CT_MAX_RETRIES) {
          throw lastError
        }

        await sleep(retryDelayMs(attempt, res.headers.get("Retry-After")))
        continue
      }

      const result = (await res.json()) as { data?: T; errors?: unknown[] }

      if (result.errors?.length) {
        throw new Error(`Commercetools GraphQL errors: ${JSON.stringify(result.errors)}`)
      }

      return result as T
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(formatCtError(error))

      if (!isTransientCtError(error) || attempt === CT_MAX_RETRIES) {
        throw lastError
      }

      await sleep(retryDelayMs(attempt, null))
    }
  }

  throw lastError ?? new Error("Commercetools GraphQL request failed")
}

export async function executeGraphQL<T = unknown>(
  query: string,
  options?: ExecuteGraphQLOptions
): Promise<T> {
  const { projectKey, apiUrl } = getCtEnv()

  try {
    return await withCtQuerySlot(async () => {
      const token = await getAccessToken()
      return executeGraphQLInner<T>(query, token, projectKey, apiUrl)
    })
  } catch (error) {
    metricsLog.warn("commercetools", "GraphQL request failed after retries", {
      label: options?.label,
      attempts: CT_MAX_RETRIES + 1,
      error: formatCtError(error),
    })
    throw error
  }
}
