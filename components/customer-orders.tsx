import { Users, UserPlus, UserCheck, ShoppingBag, TrendingUp, PercentIcon } from "lucide-react"
import { healthData } from "@/lib/data"

export function CustomerOrders() {
  const {
    new_customers,
    returning_customers,
    guest_checkouts,
    registered_user_orders,
    total_registered_users,
    conversion_rate,
  } = healthData[0].customers

  const stats = [
    {
      label: "New Customers",
      value: new_customers.toLocaleString(),
      description: "First-time buyers this week",
      icon: UserPlus,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      label: "Returning Customers",
      value: returning_customers.toLocaleString(),
      description: "Repeat purchases this week",
      icon: UserCheck,
      iconColor: "text-[hsl(var(--success))]",
      iconBg: "bg-[hsl(var(--success))]/10",
    },
    {
      label: "Guest Checkouts",
      value: guest_checkouts.toLocaleString(),
      description: "Orders without an account",
      icon: Users,
      iconColor: "text-[hsl(var(--warning))]",
      iconBg: "bg-[hsl(var(--warning))]/10",
    },
    {
      label: "Registered User Orders",
      value: registered_user_orders.toLocaleString(),
      description: "Orders by logged-in users",
      icon: ShoppingBag,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      label: "Total Registered Users",
      value: total_registered_users.toLocaleString(),
      description: "Active accounts on platform",
      icon: TrendingUp,
      iconColor: "text-[hsl(var(--success))]",
      iconBg: "bg-[hsl(var(--success))]/10",
    },
    {
      label: "Conversion Rate",
      value: conversion_rate,
      description: "Visitors to customers",
      icon: PercentIcon,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
  ]

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">Customers &amp; Registered Orders</h2>
          <p className="text-xs text-muted-foreground">Customer acquisition and order breakdown</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-lg ${stat.iconBg}`}
              >
                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
              </div>
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-card-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
