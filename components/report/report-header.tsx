import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { KWLogo } from "@/components/kw-logo"
import { formatReportDateTime } from "@/lib/timezone"
import { ReportRefreshButton } from "@/components/report/report-refresh-button"

interface ReportHeaderProps {
  year: number
  weekNum: number
  formattedRange: string
  computedAt?: string
}

export function ReportHeader({
  year,
  weekNum,
  formattedRange,
  computedAt,
}: Readonly<ReportHeaderProps>) {
  return (
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
                {computedAt ? ` · Updated ${formatReportDateTime(computedAt)}` : null}
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
            <ReportRefreshButton year={year} week={weekNum} />
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
  )
}
