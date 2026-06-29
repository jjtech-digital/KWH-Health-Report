export const HUMIO_BACKEND_SCOPE = "customer=kitchenwarehouse project=kwh"

/** All extension-runner action invocations (wildcard — error_rate denominator). */
export const HUMIO_ALL_HOOKS = "hook=/^action-/"

/** HTTP 4xx/5xx on outgoing responses — no hook filter on errors. */
export const HUMIO_HTTP_ERROR_FILTER = "context.outgoingRequest.statusCode>=400"

/** groupBy row cap — probe week ranges if truncated. */
export const HUMIO_ERROR_BREAKDOWN_GROUP_LIMIT = 500

export const HUMIO_QUERIES = {
  totalRequests: `${HUMIO_BACKEND_SCOPE} ${HUMIO_ALL_HOOKS} | count()`,
  errorBreakdown: `${HUMIO_BACKEND_SCOPE} ${HUMIO_HTTP_ERROR_FILTER} | groupBy(hook, context.outgoingRequest.statusCode, function=[count()], limit=${HUMIO_ERROR_BREAKDOWN_GROUP_LIMIT})`,
  paymentDeclined:
    "hook = action-checkout-riskifiedDecide AND context.status = declined | count()",
  paymentApprovedFailure:
    'hook = action-checkout-dispatchorder AND (severity = ERROR OR level = ERROR) AND NOT "RISK_ASSESSMENT_DECLINED" | count()',
} as const
