import { TrafficOverview } from "@/components/traffic-overview"
import { SystemHealth } from "@/components/system-health"
import { EcommerceStats } from "@/components/ecommerce-stats"
import { WebVitals } from "@/components/web-vitals"
import { CustomerOrders } from "@/components/customer-orders"
import { KWLogo } from "@/components/kw-logo"

export default function Home() {
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
                  Weekly monitoring dashboard
                </p>
              </div>
            </div>
            <span className="hidden md:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary shrink-0">
              kitchenwarehouse.com.au
            </span>
          </div>
          <div className="sm:hidden mt-2">
            <h1 className="text-base font-bold tracking-tight text-card-foreground">
              Platform Health Report
            </h1>
            <p className="text-xs text-muted-foreground">
              Weekly monitoring dashboard
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Traffic & System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <TrafficOverview />
          </div>
          <div className="lg:col-span-2">
            <SystemHealth />
          </div>
        </div>

        {/* Customers & Registered Orders */}
        <CustomerOrders />

        {/* E-commerce Stats */}
        <EcommerceStats />

        {/* Core Web Vitals */}
        <WebVitals />
      </div>
    </main>
  )
}
