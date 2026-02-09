import { ShoppingBag, AlertTriangle, ShoppingCart } from "lucide-react"
import { healthData } from "@/lib/data"

export function EcommerceStats({weekNumber}: Readonly<{weekNumber: number}>) {
  const {
    total_orders = 0,
    payment_failures_declined = 0,
    payment_failures_approved = 0,
    active_carts = 0,
  } = healthData?.find((data) => data?.week_number === weekNumber)?.ecommerce ?? {};

  const stats = [
    {
      label: "Total Orders",
      value: total_orders?.toLocaleString(),
      icon: ShoppingBag,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      valueColor: "text-card-foreground",
    },
    {
      label: "Payment Failures Declined",
      value: payment_failures_declined?.toLocaleString(),
      icon: AlertTriangle,
      iconColor: "text-[hsl(var(--destructive))]",
      iconBg: "bg-[hsl(var(--destructive))]/10",
      valueColor: "text-[hsl(var(--destructive))]",
    },
    {
      label: "Payment Failures Approved",
      value: payment_failures_approved?.toLocaleString(),
      icon: AlertTriangle,
      iconColor: "text-[hsl(var(--destructive))]",
      iconBg: "bg-[hsl(var(--destructive))]/10",
      valueColor: "text-[hsl(var(--destructive))]",
    },
    {
      label: "Active Carts",
      value: active_carts?.toLocaleString(),
      icon: ShoppingCart,
      iconColor: "text-[hsl(var(--success))]",
      iconBg: "bg-[hsl(var(--success))]/10",
      valueColor: "text-card-foreground",
    },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border bg-card p-4 sm:p-6 flex flex-col gap-3 sm:gap-4"
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-lg ${stat.iconBg}`}
            >
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${stat.valueColor}`}>{stat.value}</p>
        </div>
      ))}
    </section>
  );
}
