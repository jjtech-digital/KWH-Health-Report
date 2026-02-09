export const healthData = [
  {
    week_number: 1,
    traffic: {
      total_views: 640465,
      top_pages: [
        { path: "/", views: 78939 },
        { path: "/search", views: 70253 },
        { path: "/checkout", views: 25566 },
        { path: "/clearance-specials", views: 13852 },
        { path: "/cart", views: 10375 },
      ],
      browsers: [
        { name: "Chrome", views: 205900, percentage: 42.0 },
        { name: "Safari", views: 183740, percentage: 37.5 },
        { name: "Other", views: 49746, percentage: 10.1 },
        { name: "Edge", views: 23196, percentage: 4.7 },
        { name: "Firefox", views: 14446, percentage: 2.9 },
        { name: "Samsung Internet", views: 13140, percentage: 2.7 },
      ],
    },
    reliability: {
      failed_requests: 352,
      error_rate: '0.0550%',
      top_failed_pages: [
        {
          path: '/status/extensionrunner', failures: 167, status: 500 },
        { path: '/checkout/validatestock', failures: 163, status: 400 },
        { path: '/frontastic/page', failures: 11, status: 503 },
        { path: '/ct-auth/getAnonymousAccessToken', failures: 7, status: 500 },
        { path: '/products/list', failures: 4, status: 500 },
      ],
    },
    ecommerce: {
      total_orders: 9721,
      payment_failures_declined: 4,
      payment_failures_approved: 7,
      active_carts: 666213,
    },
    customers: {
      first_time_buyers: 458,
      returning_customers: 0,
      guest_checkouts: 2801,
      registered_user_orders: 6920,
      total_registered_users: 1424,
      conversion_rate: '1.9%',
    },
    web_vitals: {
      lcp: "2.5s",
      fid: "200ms",
      cls: "0.1",
    },
  },
];
