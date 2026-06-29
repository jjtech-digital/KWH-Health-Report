export interface TopPage {
  path: string
  views: number
}

export interface BrowserBreakdown {
  name: string
  views: number
  percentage: number
}

export interface Traffic {
  total_views: number
  top_pages: TopPage[]
  browsers: BrowserBreakdown[]
}

export interface FailedPage {
  path: string
  failures: number
  status: number
}

export interface Reliability {
  failed_requests: number
  error_rate: string
  top_failed_pages: FailedPage[]
}

export interface Ecommerce {
  total_orders: number
  payment_failures_declined: number
  payment_failures_approved: number
  active_carts: number
}

export interface Customers {
  first_time_buyers: number
  returning_customers: number
  guest_checkouts: number
  registered_user_orders: number
  total_registered_users: number
  conversion_rate: string
}

export interface DeviceVitals {
  lcp: string
  fid: string
  cls: string
}

export interface WebVitals {
  desktop: DeviceVitals
  mobile: DeviceVitals
}

export interface HealthReportWeek {
  week_number: number
  year: number
  computed_at: string
  traffic: Traffic
  reliability: Reliability
  ecommerce: Ecommerce
  customers: Customers
  web_vitals: WebVitals
}

export const emptyTraffic = (): Traffic => ({
  total_views: 0,
  top_pages: [],
  browsers: [],
})

export const emptyReliability = (): Reliability => ({
  failed_requests: 0,
  error_rate: "0%",
  top_failed_pages: [],
})

export const emptyEcommerce = (): Ecommerce => ({
  total_orders: 0,
  payment_failures_declined: 0,
  payment_failures_approved: 0,
  active_carts: 0,
})

export const emptyCustomers = (): Customers => ({
  first_time_buyers: 0,
  returning_customers: 0,
  guest_checkouts: 0,
  registered_user_orders: 0,
  total_registered_users: 0,
  conversion_rate: "0%",
})

export const emptyDeviceVitals = (): DeviceVitals => ({
  lcp: "0s",
  fid: "0ms",
  cls: "0",
})

export const emptyWebVitals = (): WebVitals => ({
  desktop: emptyDeviceVitals(),
  mobile: emptyDeviceVitals(),
})
