"use client"
import { Users, UserPlus, UserCheck, ShoppingBag, TrendingUp, PercentIcon, Info, X } from "lucide-react"
import { healthData } from "@/lib/data"
import { useState } from "react"

export function CustomerOrders({weekNumber}: Readonly<{weekNumber: number}>) {
  const {
    first_time_buyers = 0,
    returning_customers = 0,
    guest_checkouts = 0,
    registered_user_orders = 0,
    total_registered_users = 0,
    conversion_rate = '—',
  } = healthData?.find((data) => data?.week_number === weekNumber)?.customers || {}

  const [selectedModal, setSelectedModal] = useState<string | null>(null)

  const modalContent = {
    "New Customers": {
      title: "New Customers",
      description: "This metric tracks first-time buyers who made their initial purchase during this specific week. These are customers who have never made a purchase on the platform before.",
      importance: "Understanding new customer acquisition helps measure the effectiveness of marketing campaigns and brand awareness efforts."
    },
    "Returning Customers": {
      title: "Returning Customers", 
      description: "This shows existing customers who made repeat purchases during the week. These are valuable customers who have previously bought from the platform.",
      importance: "High returning customer rates indicate strong customer satisfaction and loyalty, which is crucial for sustainable business growth."
    },
    "Guest Checkouts": {
      title: "Guest Checkouts",
      description: "Orders completed by customers without creating an account or logging in. These purchases are made through the guest checkout process.",
      importance: "While convenient for customers, high guest checkout rates may indicate opportunities to encourage account creation for better customer retention."
    },
    "Registered User Orders": {
      title: "Registered User Orders",
      description: "Orders placed by customers who have accounts and were logged in during the purchase process.",
      importance: "Registered orders provide better customer data for personalization and marketing, and typically have higher lifetime value."
    },
    "Total Registered Users": {
      title: "Total Registered Users",
      description: "The cumulative count of all active user accounts on the platform as of this week.",
      importance: "Growing registered user base indicates platform adoption and provides opportunities for targeted marketing and customer retention."
    },
    "Conversion Rate": {
      title: "Conversion Rate",
      description: "The percentage of website visitors who complete a purchase during their visit. Calculated as (total orders / total visitors) × 100.",
      importance: "A key performance indicator that measures how effectively the website converts traffic into sales. Higher rates indicate better user experience and sales funnel optimization."
    }
  }

  const stats = [
    {
      label: "New Customers",
      value: first_time_buyers.toLocaleString(),
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-lg ${stat.iconBg}`}
                >
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              </div>
              <button
                onClick={() => setSelectedModal(stat.label)}
                className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-muted transition-colors"
                aria-label={`More info about ${stat.label}`}
              >
                <Info className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </div>
            <p className="text-2xl font-bold tracking-tight text-card-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </div>
        ))}
      </div>
      
      {/* Modal */}
      {selectedModal && modalContent[selectedModal as keyof typeof modalContent] && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedModal(null)}
        >
          <div 
            className="bg-card border border-border rounded-lg max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
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
