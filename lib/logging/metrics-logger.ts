type MetricsSource = "redis" | "datadog" | "humio" | "assembler" | "commercetools" | "cron"
type LogLevel = "info" | "warn" | "error"

export interface SerializedError {
  name?: string
  message: string
  stack?: string
  cause?: SerializedError
  code?: string
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }

    const code = (error as Error & { code?: unknown }).code
    if (typeof code === "string" || typeof code === "number") {
      serialized.code = String(code)
    }

    if (error.cause !== undefined) {
      serialized.cause = serializeError(error.cause)
    }

    return serialized
  }

  if (typeof error === "string") {
    return { message: error }
  }

  if (typeof error === "object" && error !== null) {
    try {
      return { message: JSON.stringify(error) }
    } catch {
      return { message: Object.prototype.toString.call(error) }
    }
  }

  return { message: String(error) }
}

function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context || Object.keys(context).length === 0) return undefined

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      sanitized[key] = serializeError(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

function emitLog(
  level: LogLevel,
  source: MetricsSource,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): void {
  const payload: Record<string, unknown> = {
    level,
    tag: `[kwh-reports][${source}]`,
    message,
    time: new Date().toISOString(),
  }

  const sanitizedContext = sanitizeContext(context)
  if (sanitizedContext) {
    Object.assign(payload, sanitizedContext)
  }

  if (error !== undefined) {
    payload.error = serializeError(error)
  }

  const line = JSON.stringify(payload)

  if (level === "error") {
    console.error(line)
    return
  }
  if (level === "warn") {
    console.warn(line)
    return
  }
  console.log(line)
}

export const metricsLog = {
  info: (source: MetricsSource, message: string, context?: Record<string, unknown>) =>
    emitLog("info", source, message, undefined, context),
  warn: (source: MetricsSource, message: string, context?: Record<string, unknown>) =>
    emitLog("warn", source, message, undefined, context),
  error: (
    source: MetricsSource,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ) => emitLog("error", source, message, error, context),
}
