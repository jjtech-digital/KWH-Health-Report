/** Shared transient-error detection for CT GraphQL and metric-level retries. */
export function isTransientCtError(error: unknown, status?: number): boolean {
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

export function isCtTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("timed out")
}
