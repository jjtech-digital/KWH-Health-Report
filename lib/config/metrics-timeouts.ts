export const METRICS_CT_TIMEOUT_MS = Number.parseInt(
  process.env.METRICS_CT_TIMEOUT_MS ?? "300000",
  10
)

export const METRICS_HUMIO_TIMEOUT_MS = Number.parseInt(
  process.env.METRICS_HUMIO_TIMEOUT_MS ?? "1200000",
  10
)

export const METRICS_INVOCATION_BUDGET_MS = Number.parseInt(
  process.env.METRICS_INVOCATION_BUDGET_MS ?? "270000",
  10
)
