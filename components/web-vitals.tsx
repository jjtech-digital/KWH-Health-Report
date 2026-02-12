import { Monitor, TabletSmartphone } from "lucide-react"
import { healthData } from "@/lib/data"

function getVitalStatus(metric: string, value: string): { color: string; label: string; bg: string } {
  const num = Number.parseFloat(value)

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

const metrics = [
  {
    key: "lcp",
    label: "LCP",
    description: "Largest Contentful Paint",
    threshold: "< 2.5s",
  },
  {
    key: "fid",
    label: "FID",
    description: "First Input Delay",
    threshold: "< 100ms",
  },
  {
    key: "cls",
    label: "CLS",
    description: "Cumulative Layout Shift",
    threshold: "< 0.1",
  },
]

function VitalsSection({ device, weekNumber }: { device: 'mobile' | 'desktop'; weekNumber: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          {device === 'mobile' ? (
            <TabletSmartphone className="w-5 h-5 text-primary" />
          ) : (
            <Monitor className="w-5 h-5 text-primary" />
          )}
        </div>
        <h3 className="text-sm font-medium text-muted-foreground capitalize">
          {device} Core Web Vitals
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const weekData = healthData?.find((data) => data?.week_number === weekNumber);
          const vitals =
            device === "mobile"
              ? weekData?.web_vitals?.mobile
              : weekData?.web_vitals?.desktop;
          const fallback = { lcp: "0s", fid: "0ms", cls: "0" };
          const value = (vitals?.[metric.key as keyof typeof fallback] as string) || fallback[metric.key as keyof typeof fallback];
          const status = getVitalStatus(metric.key, value);
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
              <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${status.color}`}>{value}</p>
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
    </div>
  )
}

export function WebVitals({ weekNumber }: Readonly<{ weekNumber: number }>) {
  return (
    <section className="flex flex-col gap-8">
      <VitalsSection device="mobile" weekNumber={weekNumber} />
      <VitalsSection device="desktop" weekNumber={weekNumber} />
    </section>
  )
}
