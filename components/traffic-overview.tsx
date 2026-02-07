import { Eye, Globe } from "lucide-react"
import { healthData } from "@/lib/data"

const BROWSER_COLORS: Record<string, string> = {
  Chrome: "bg-[#4285F4]",
  Safari: "bg-[#00B2FF]",
  Firefox: "bg-[#FF7139]",
  Edge: "bg-[#0078D7]",
  "Samsung Internet": "bg-[#1428A0]",
  Other: "bg-muted-foreground",
}

export function TrafficOverview() {
  const { total_views, top_pages, browsers } = healthData.traffic
  const maxViews = top_pages[0]?.views ?? 1

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Eye className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Total Page Views</h2>
          <p className="text-3xl font-bold tracking-tight text-card-foreground">
            {total_views.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Browser Breakdown */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Views by Browser
          </h3>
        </div>

        {/* Stacked bar */}
        <div className="flex h-3 w-full rounded-full overflow-hidden mb-3">
          {browsers.map((browser) => (
            <div
              key={browser.name}
              className={`${BROWSER_COLORS[browser.name] ?? "bg-muted-foreground"}`}
              style={{ width: `${browser.percentage}%` }}
              title={`${browser.name}: ${browser.views.toLocaleString()} (${browser.percentage}%)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
          {browsers.map((browser) => (
            <div key={browser.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${BROWSER_COLORS[browser.name] ?? "bg-muted-foreground"}`}
                />
                <span className="text-xs text-card-foreground truncate">{browser.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-semibold tabular-nums text-card-foreground">
                  {browser.views.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">({browser.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border mb-6" />

      {/* Top 5 Pages */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Top 5 Pages
        </h3>
        <div className="flex flex-col gap-3">
          {top_pages
            .sort((a, b) => b.views - a.views)
            .map((page) => {
              const percentage = (page.views / maxViews) * 100
              return (
                <div key={page.path} className="relative">
                  <div
                    className="absolute inset-0 rounded-lg bg-primary/8"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative flex items-center justify-between px-2 sm:px-3 py-2 sm:py-2.5">
                    <span className="text-xs sm:text-sm font-mono font-medium text-card-foreground truncate mr-2">
                      {page.path}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold tabular-nums text-muted-foreground shrink-0">
                      {page.views.toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </section>
  )
}
