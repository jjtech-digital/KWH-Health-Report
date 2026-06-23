import Link from "next/link"
import { format } from "date-fns"
import { getWeekReport } from "@/lib/services/get-week-report"
import { getWeekDateRange, parseWeekParam, parseYearParam } from "@/lib/weeks"
import { ReportHeader } from "@/components/report/report-header"
import { TrafficOverview } from "@/components/report/traffic-overview"
import { SystemHealth } from "@/components/report/system-health"
import { CustomerOrders } from "@/components/report/customer-orders"
import { EcommerceStats } from "@/components/report/ecommerce-stats"
import { WebVitals } from "@/components/report/web-vitals"

interface ReportPageProps {
  params: Promise<{ year: string; week: string }>
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { year: yearParam, week: weekParam } = await params
  const year = parseYearParam(yearParam)
  const weekNum = parseWeekParam(weekParam)

  if (year === null || weekNum === null) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
            <h1 className="text-lg font-bold tracking-tight text-card-foreground">Invalid report URL</h1>
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
    )
  }

  const { start, end } = getWeekDateRange(year, weekNum)
  const formattedRange = `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`
  const report = await getWeekReport(year, weekNum)

  return (
    <main className="min-h-screen bg-background">
      <ReportHeader
        year={year}
        weekNum={weekNum}
        formattedRange={formattedRange}
        computedAt={report.computed_at}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <TrafficOverview traffic={report.traffic} />
          </div>
          <div className="lg:col-span-2">
            <SystemHealth reliability={report.reliability} />
          </div>
        </div>
        <CustomerOrders customers={report.customers} />
        <EcommerceStats ecommerce={report.ecommerce} />
        <WebVitals webVitals={report.web_vitals} />
      </div>
    </main>
  )
}
