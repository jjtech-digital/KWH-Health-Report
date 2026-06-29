"use client"

import { useState } from "react"
import {
  Users,
  UserPlus,
  UserCheck,
  ShoppingBag,
  TrendingUp,
  PercentIcon,
  Info,
  X,
} from "lucide-react"
import type { Customers } from "@/lib/types/health-report"

const modalContent = {
  "New Customers": {
    title: "New Customers",
    description:
      "This metric tracks first-time buyers who made their initial purchase during this specific week. These are customers who have never made a purchase on the platform before.",
    importance:
      "Understanding new customer acquisition helps measure the effectiveness of marketing campaigns and brand awareness efforts.",
  },
  "Returning Customers": {
    title: "Returning Customers",
    description:
      "This shows existing customers who made repeat purchases during the week. These are valuable customers who have previously bought from the platform.",
    importance:
      "High returning customer rates indicate strong customer satisfaction and loyalty, which is crucial for sustainable business growth.",
  },
  "Guest Checkouts": {
    title: "Guest Checkouts",
    description:
      "Orders completed by customers without creating an account or logging in. These purchases are made through the guest checkout process.",
    importance:
      "While convenient for customers, high guest checkout rates may indicate opportunities to encourage account creation for better customer retention.",
  },
  "Registered User Orders": {
    title: "Registered User Orders",
    description:
      "Orders placed by customers who have accounts and were logged in during the purchase process.",
    importance:
      "Registered orders provide better customer data for personalization and marketing, and typically have higher lifetime value.",
  },
  "Total Registered Users": {
    title: "Total Registered Users",
    description: "New customer accounts created on the platform during this week.",
    importance:
      "Growing registered user base indicates platform adoption and provides opportunities for targeted marketing and customer retention.",
  },
  "Conversion Rate": {
    title: "Conversion Rate",
    description:
      "The percentage of website visitors who complete a purchase during their visit. Calculated as (total orders / total views) × 100.",
    importance:
      "A key performance indicator that measures how effectively the website converts traffic into sales.",
  },
} as const

export function CustomerOrders({ customers }: Readonly<{ customers: Customers }>) {
  const [selectedModal, setSelectedModal] = useState<string | null>(null)

  const stats = [
    {
      label: "New Customers",
      value: customers.first_time_buyers.toLocaleString(),
      description: "First-time buyers this week",
      icon: UserPlus,
    },
    {
      label: "Returning Customers",
      value: customers.returning_customers.toLocaleString(),
      description: "Repeat purchases this week",
      icon: UserCheck,
    },
    {
      label: "Guest Checkouts",
      value: customers.guest_checkouts.toLocaleString(),
      description: "Orders without an account",
      icon: Users,
    },
    {
      label: "Registered User Orders",
      value: customers.registered_user_orders.toLocaleString(),
      description: "Orders by logged-in users",
      icon: ShoppingBag,
    },
    {
      label: "Total Registered Users",
      value: customers.total_registered_users.toLocaleString(),
      description: "New accounts created this week",
      icon: TrendingUp,
    },
    {
      label: "Conversion Rate",
      value: customers.conversion_rate,
      description: "Orders per page view",
      icon: PercentIcon,
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModal(stat.label)}
                className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-muted transition-colors"
                aria-label={`More info about ${stat.label}`}
              >
                <Info className="w-3 h-3 text-primary/70 hover:text-primary transition-colors" />
              </button>
            </div>
            <p className="text-2xl font-bold tracking-tight text-card-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </div>
        ))}
      </div>

      {selectedModal && modalContent[selectedModal as keyof typeof modalContent] && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedModal(null)}
          role="presentation"
        >
          <div
            className="bg-card border border-border rounded-lg max-w-md w-full p-6 relative"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setSelectedModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 text-primary" />
            </button>
            <div className="pr-8">
              <h3 className="text-lg font-semibold mb-3 text-card-foreground">
                {modalContent[selectedModal as keyof typeof modalContent].title}
              </h3>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-card-foreground mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {modalContent[selectedModal as keyof typeof modalContent].description}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-card-foreground mb-1">Why It Matters</h4>
                  <p className="text-sm text-muted-foreground">
                    {modalContent[selectedModal as keyof typeof modalContent].importance}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
