import "server-only"

import { metricsLog } from "@/lib/logging/metrics-logger"
import { isTransientCtError } from "./ct-errors"
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
  signal?: AbortSignal
}

function requestSignal(options?: ExecuteGraphQLOptions): AbortSignal {
  if (options?.signal) {
    return AbortSignal.any([options.signal, AbortSignal.timeout(CT_FETCH_TIMEOUT_MS)])
  }
  return AbortSignal.timeout(CT_FETCH_TIMEOUT_MS)
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

function isTransientCtErrorLocal(error: unknown, status?: number): boolean {
  return isTransientCtError(error, status)
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
  apiUrl: string,
  signal: AbortSignal
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
        signal,
      })

      if (!res.ok) {
        const errorText = await res.text()
        lastError = new Error(
          `Commercetools GraphQL request failed: ${res.status} ${errorText}`
        )

        if (!isTransientCtErrorLocal(lastError, res.status) || attempt === CT_MAX_RETRIES) {
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

      if (!isTransientCtErrorLocal(error) || attempt === CT_MAX_RETRIES) {
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
      const signal = requestSignal(options)
      return executeGraphQLInner<T>(query, token, projectKey, apiUrl, signal)
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
