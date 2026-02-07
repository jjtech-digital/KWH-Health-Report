export const healthData = {
  traffic: {
    total_views: 125400,
    top_pages: [
      { path: "/home", views: 45000 },
      { path: "/products", views: 32000 },
      { path: "/blog/ai-tips", views: 15000 },
      { path: "/checkout", views: 12000 },
      { path: "/about", views: 8000 },
    ],
    browsers: [
      { name: "Chrome", views: 62700, percentage: 50.0 },
      { name: "Safari", views: 30096, percentage: 24.0 },
      { name: "Firefox", views: 13794, percentage: 11.0 },
      { name: "Edge", views: 11286, percentage: 9.0 },
      { name: "Samsung Internet", views: 5016, percentage: 4.0 },
      { name: "Other", views: 2508, percentage: 2.0 },
    ],
  },
  reliability: {
    failed_requests: 124,
    error_rate: "0.08%",
    top_failed_pages: [
      { path: "/api/checkout", failures: 42, status: 500 },
      { path: "/api/payment", failures: 31, status: 502 },
      { path: "/products/detail", failures: 22, status: 503 },
      { path: "/api/inventory", failures: 18, status: 500 },
      { path: "/user/profile", failures: 11, status: 504 },
    ],
  },
  ecommerce: {
    total_orders: 1240,
    payment_failures: 12,
    active_carts: 85,
  },
  customers: {
    new_customers: 312,
    returning_customers: 189,
    guest_checkouts: 74,
    registered_user_orders: 1166,
    total_registered_users: 4820,
    conversion_rate: "6.5%",
  },
  web_vitals: {
    lcp: "2.1s",
    fid: "12ms",
    cls: "0.05",
  },
}
