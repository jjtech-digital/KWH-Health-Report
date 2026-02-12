"use client"
import { ShoppingBag, AlertTriangle, ShoppingCart, Info, X } from "lucide-react"
import { healthData } from "@/lib/data"
import { useState } from "react"

export function EcommerceStats({weekNumber}: Readonly<{weekNumber: number}>) {
  const {
    total_orders = 0,
    payment_failures_declined = 0,
    payment_failures_approved = 0,
    active_carts = 0,
  } = healthData?.find((data) => data?.week_number === weekNumber)?.ecommerce ?? {};

  const [selectedModal, setSelectedModal] = useState<string | null>(null)

  const modalContent = {
    "Total Orders": {
      title: "Total Orders",
      description: "The total number of completed orders processed during this week. This includes all successful transactions regardless of payment method or order value.",
      importance: "A key indicator of business performance and sales volume. Tracking trends helps identify seasonal patterns, promotional effectiveness, and overall business growth."
    },
    "Payment Failures Declined": {
      title: "Payment Failures Declined",
      description: "Orders where the payment was attempted but declined by the payment processor or bank. These are failed transactions that customers could not complete.",
      importance: "High decline rates may indicate payment gateway issues, fraud detection problems, or customer payment method issues. Monitoring helps improve checkout success rates."
    },
    "Payment Failures Approved": {
      title: "Payment Failures Approved", 
      description: "Orders where the payment was initially approved but later failed during processing. This can occur due to insufficient funds, expired cards, or processing errors.",
      importance: "These failures can impact customer experience and revenue. Understanding patterns helps optimize payment processing and reduce revenue loss from approved transactions that fail."
    },
    "Active Carts": {
      title: "Active Carts",
      description: "The number of shopping carts that currently contain items but haven't been converted to orders. These represent potential sales in progress.",
      importance: "High active cart numbers with low conversion may indicate checkout friction. Monitoring helps identify opportunities for cart abandonment recovery and checkout optimization."
    }
  }

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-lg ${stat.iconBg}`}
              >
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
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
          <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${stat.valueColor}`}>{stat.value}</p>
        </div>
      ))}
      
      {/* Modal */}
      {selectedModal && modalContent[selectedModal as keyof typeof modalContent] && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedModal(null)}
        >
          <button
            className="absolute inset-0 w-full h-full bg-transparent border-0 p-0 m-0 cursor-pointer"
            style={{ zIndex: 1 }}
            aria-label="Close modal"
            onClick={() => setSelectedModal(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
                setSelectedModal(null);
              }
            }}
          />
          <div 
            className="bg-card border border-border rounded-lg max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 2 }}
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
  );
}
