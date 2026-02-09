import { ShieldAlert } from "lucide-react"
import { healthData } from "@/lib/data"

export function SystemHealth({weekNumber}: Readonly<{weekNumber: number}>) {
  const { failed_requests, error_rate, top_failed_pages } = healthData?.find((data) => data?.week_number === weekNumber)?.reliability || { failed_requests: 0, error_rate: "0%", top_failed_pages: [] };
  const hasFailures = failed_requests > 0
  const maxFailures = top_failed_pages.length > 0 ? top_failed_pages[0].failures : 1

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg ${
            hasFailures ? "bg-[hsl(var(--warning))]/10" : "bg-[hsl(var(--success))]/10"
          }`}
        >
          <ShieldAlert
            className={`w-5 h-5 ${
              hasFailures ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]"
            }`}
          />
        </div>
        <h2 className="text-sm font-medium text-muted-foreground">System Health</h2>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Failed Requests</p>
          <div className="flex items-center gap-2">
            <span
              className={`text-3xl font-bold tracking-tight ${
                hasFailures ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]"
              }`}
            >
              {failed_requests.toLocaleString()}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hasFailures
                  ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                  : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
              }`}
            >
              {error_rate} error rate
            </span>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Top 5 Failed Page Requests */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3">Top 5 Failed Requests</p>
          <div className="flex flex-col gap-2.5">
            {top_failed_pages.map((page, index) => (
              <div key={page.path} className="flex flex-col gap-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{index + 1}.</span>
                    <span className="font-mono text-foreground text-xs sm:text-sm truncate">{page.path}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6 sm:ml-0 shrink-0">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                     {page.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {page.failures} fails
                    </span>
                  </div>
                </div>
                
                <div className="relative h-1.5 w-100 rounded-full bg-muted overflow-hidden ml-6">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-destructive/60"
                    style={{ width: `${(page.failures / maxFailures) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              hasFailures ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {hasFailures
              ? "Some requests are failing. Monitor closely."
              : "All systems operational."}
          </span>
        </div>
      </div>
    </section>
  )
}
