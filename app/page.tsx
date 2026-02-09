import { KWLogo } from "@/components/kw-logo"
import { ReportIndex } from "@/components/report-index"
import { generateReportIndex } from "@/lib/weeks"

export default function Home() {
  const data = generateReportIndex()
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
                  Platform Health Reports
                </h1>
                <p className="text-xs text-muted-foreground">
                  Browse weekly monitoring reports
                </p>
              </div>
            </div>
            <span className="hidden md:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary shrink-0">
              kitchenwarehouse.com.au
            </span>
          </div>
          <div className="sm:hidden mt-2">
            <h1 className="text-base font-bold tracking-tight text-card-foreground">
              Platform Health Reports
            </h1>
            <p className="text-xs text-muted-foreground">
              Browse weekly monitoring reports
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <ReportIndex data={data} />
      </div>
    </main>
  )
}
