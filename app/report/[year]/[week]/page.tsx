import { TrafficOverview } from "@/components/traffic-overview"
import { SystemHealth } from "@/components/system-health"
import { EcommerceStats } from "@/components/ecommerce-stats"
import { WebVitals } from "@/components/web-vitals"
import { CustomerOrders } from "@/components/customer-orders"
import { KWLogo } from "@/components/kw-logo"
import { getWeekDateRange } from "@/lib/weeks"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function ReportPage({
  params,
}: {
  params: Promise<{ year: string; week: string }>
}) {
  const { year, week } = await params
  const weekNum = parseInt(week.replace("w", ""), 10);
  const { start, end } = getWeekDateRange(parseInt(year, 10), weekNum)

  const formattedRange = `${start.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  })} – ${end.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`

  return (
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
                  Week {weekNum}, {year} &middot; {formattedRange}
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
              Week {weekNum}, {year} &middot; {formattedRange}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <TrafficOverview weekNumber={weekNum} />
          </div>
          <div className="lg:col-span-2">
            <SystemHealth weekNumber={weekNum} />
          </div>
        </div>
        <CustomerOrders weekNumber={weekNum} />
        <EcommerceStats weekNumber={weekNum} />
        <WebVitals weekNumber={weekNum} />
      </div>
    </main>
  )
}
