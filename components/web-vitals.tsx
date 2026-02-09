import { Gauge } from "lucide-react"
import { healthData } from "@/lib/data"

function getVitalStatus(metric: string, value: string): { color: string; label: string; bg: string } {
  const num = parseFloat(value)

  switch (metric) {
    case "lcp":
      if (num < 2.5) return { color: "text-[hsl(var(--success))]", label: "Good", bg: "bg-[hsl(var(--success))]" }
      if (num < 4) return { color: "text-[hsl(var(--warning))]", label: "Needs Improvement", bg: "bg-[hsl(var(--warning))]" }
      return { color: "text-[hsl(var(--destructive))]", label: "Poor", bg: "bg-[hsl(var(--destructive))]" }
    case "fid":
      if (num < 100) return { color: "text-[hsl(var(--success))]", label: "Good", bg: "bg-[hsl(var(--success))]" }
      if (num < 300) return { color: "text-[hsl(var(--warning))]", label: "Needs Improvement", bg: "bg-[hsl(var(--warning))]" }
      return { color: "text-[hsl(var(--destructive))]", label: "Poor", bg: "bg-[hsl(var(--destructive))]" }
    case "cls":
      if (num < 0.1) return { color: "text-[hsl(var(--success))]", label: "Good", bg: "bg-[hsl(var(--success))]" }
      if (num < 0.25) return { color: "text-[hsl(var(--warning))]", label: "Needs Improvement", bg: "bg-[hsl(var(--warning))]" }
      return { color: "text-[hsl(var(--destructive))]", label: "Poor", bg: "bg-[hsl(var(--destructive))]" }
    default:
      return { color: "text-muted-foreground", label: "Unknown", bg: "bg-muted" }
  }
}

export function WebVitals({weekNumber}: Readonly<{weekNumber: number}>) {
  const vitals = healthData?.find((data) => data?.week_number === weekNumber)?.web_vitals || { lcp: "0s", fid: "0ms", cls: "0" };

  const metrics = [
    {
      key: "lcp",
      label: "LCP",
      description: "Largest Contentful Paint",
      value: vitals?.lcp,
      threshold: "< 2.5s",
    },
    {
      key: "fid",
      label: "FID",
      description: "First Input Delay",
      value: vitals?.fid,
      threshold: "< 100ms",
    },
    {
      key: "cls",
      label: "CLS",
      description: "Cumulative Layout Shift",
      value: vitals?.cls,
      threshold: "< 0.1",
    },
  ]

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Gauge className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-sm font-medium text-muted-foreground">Core Web Vitals</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const status = getVitalStatus(metric.key, metric.value || "")
          return (
            <div
              key={metric.key}
              className="rounded-xl border border-border bg-card p-4 sm:p-6 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-card-foreground">{metric.label}</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color} ${status.bg}/10`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
                  {status.label}
                </span>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${status.color}`}>{metric.value}</p>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{metric.description}</p>
                <p className="text-xs text-muted-foreground">
                  Target: <span className="font-medium text-card-foreground">{metric.threshold}</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
