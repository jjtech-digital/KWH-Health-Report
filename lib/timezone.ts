import { TZDate } from "@date-fns/tz"

export const REPORT_TIMEZONE = "Australia/Sydney"

export function nowInReportTz(): TZDate {
  return TZDate.tz(REPORT_TIMEZONE)
}

export function formatReportDateTime(iso: string): string {
  return new TZDate(iso, REPORT_TIMEZONE).toLocaleString("en-AU", {
    timeZone: REPORT_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  })
}
