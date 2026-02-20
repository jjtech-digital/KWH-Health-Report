"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { PasswordGate } from "@/components/password-gate"
import { TrafficOverview } from "@/components/traffic-overview"
import { SystemHealth } from "@/components/system-health"
import { EcommerceStats } from "@/components/ecommerce-stats"
import { WebVitals } from "@/components/web-vitals"
import { CustomerOrders } from "@/components/customer-orders"
import { KWLogo } from "@/components/kw-logo"
import { getWeekDateRange } from "@/lib/weeks"

function coerceParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default function ReportPage() {
  const params = useParams() as {
    year?: string | string[]
    week?: string | string[]
  }

  const report = useMemo(() => {
    const yearStr = coerceParam(params.year)
    const weekStr = coerceParam(params.week)
    if (!yearStr || !weekStr) return null

    const year = Number.parseInt(yearStr, 10)
    const weekNum = Number.parseInt(weekStr.replace(/^w/i, ""), 10)
    if (!Number.isFinite(year) || !Number.isFinite(weekNum)) return null

    const { start, end } = getWeekDateRange(year, weekNum)
    const formattedRange = `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`

    return { year, weekNum, formattedRange }
  }, [params.year, params.week])

  return (
    <PasswordGate>
      {report ? (
        <main className="min-h-screen bg-background">
          <header className="bg-card border-b border-border">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <KWLogo />
                  <div className="hidden sm:block h-8 w-px bg-border shrink-0" />
                  <div className="hidden sm:block min-w-0">
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-card-foreground truncate">
                      Platform Health Report
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Week {report.weekNum}, {report.year} &middot;{" "}
                      {report.formattedRange}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    All Reports
                  </Link>
                  <span className="hidden md:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    kitchenwarehouse.com.au
                  </span>
                </div>
              </div>
              <div className="sm:hidden mt-2">
                <h1 className="text-base font-bold tracking-tight text-card-foreground">
                  Platform Health Report
                </h1>
                <p className="text-xs text-muted-foreground">
                  Week {report.weekNum}, {report.year} &middot;{" "}
                  {report.formattedRange}
                </p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <TrafficOverview weekNumber={report.weekNum} />
              </div>
              <div className="lg:col-span-2">
                <SystemHealth weekNumber={report.weekNum} />
              </div>
            </div>
            <CustomerOrders weekNumber={report.weekNum} />
            <EcommerceStats weekNumber={report.weekNum} />
            <WebVitals weekNumber={report.weekNum} />
          </div>
        </main>
      ) : (
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <h1 className="text-lg font-bold tracking-tight text-card-foreground">
                Invalid report URL
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Please return to the index and select a report.
              </p>
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Back to reports
                </Link>
              </div>
            </div>
          </div>
        </main>
      )}
    </PasswordGate>
  )
}
