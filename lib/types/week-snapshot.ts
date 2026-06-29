import { z } from "zod"
import type { HealthReportWeek } from "@/lib/types/health-report"

const topPageSchema = z.object({
  path: z.string(),
  views: z.number(),
})

const browserBreakdownSchema = z.object({
  name: z.string(),
  views: z.number(),
  percentage: z.number(),
})

const failedPageSchema = z.object({
  path: z.string(),
  failures: z.number(),
  status: z.number(),
})

const deviceVitalsSchema = z.object({
  lcp: z.string(),
  fid: z.string(),
  cls: z.string(),
})

export const healthReportWeekSchema = z.object({
  week_number: z.number(),
  year: z.number(),
  computed_at: z.string(),
  traffic: z.object({
    total_views: z.number(),
    top_pages: z.array(topPageSchema),
    browsers: z.array(browserBreakdownSchema),
  }),
  reliability: z.object({
    failed_requests: z.number(),
    error_rate: z.string(),
    top_failed_pages: z.array(failedPageSchema),
  }),
  ecommerce: z.object({
    total_orders: z.number(),
    payment_failures_declined: z.number(),
    payment_failures_approved: z.number(),
    active_carts: z.number(),
  }),
  customers: z.object({
    first_time_buyers: z.number(),
    returning_customers: z.number(),
    guest_checkouts: z.number(),
    registered_user_orders: z.number(),
    total_registered_users: z.number(),
    conversion_rate: z.string(),
  }),
  web_vitals: z.object({
    desktop: deviceVitalsSchema,
    mobile: deviceVitalsSchema,
  }),
})

export function parseHealthReportWeek(data: unknown): HealthReportWeek | null {
  const result = healthReportWeekSchema.safeParse(data)
  return result.success ? result.data : null
}
