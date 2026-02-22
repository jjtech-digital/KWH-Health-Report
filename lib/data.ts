export const healthData = [
  {
    week_number: 3,
    traffic: {
      total_views: 605229,
      top_pages: [
        { path: "/", views: 70698 },
        { path: "/search", views: 9394 },
        { path: "/blog/recipes/healthier-marry-me-chicken", views: 8594 },
        {
          path: "/product/wolstead-bliss-soft-serve-and-slushy-maker-1-8l-white",
          views: 6408,
        },
        {
          path: "/product/kitchen-pro-eco-square-glass-canister-with-glass-lid-set-12pc",
          views: 4938,
        },
      ],
      browsers: [
        { name: "Chrome", views: 183931, percentage: 40.1 },
        { name: "Safari", views: 52768, percentage: 11.5 },
        { name: "Other", views: 168956, percentage: 36.8 },
        { name: "Edge", views: 20492, percentage: 4.5 },
        { name: "Firefox", views: 7721, percentage: 1.7 },
        { name: "Samsung Internet", views: 12321, percentage: 2.7 },
      ],
    },
    reliability: {
      failed_requests: 1082,
      error_rate: "0.18%",
      top_failed_pages: [
        { path: "/frontastic/page", failures: 835, status: 503 },
        { path: "/frontastic/action/ct-auth/getAccessTokenByRefreshToken", failures: 159, status: 500 },
        { path: "/frontastic/action/products/list", failures: 45, status: 542 },
        { path: "/frontastic/action/checkout/details", failures: 28, status: 500 },
        { path: "/frontastic/action/products/algolia-events", failures: 15, status: 542 },
      ],
    },
    ecommerce: {
      total_orders: 8593,  
      payment_failures_declined: 4,
      payment_failures_approved: 9,
      active_carts: 625321, 
    },
    customers: {
      first_time_buyers: 434, 
      returning_customers: 185,
      guest_checkouts: 2485,
      registered_user_orders: 6107,
      total_registered_users: 1278,
      conversion_rate: "1.90%",
    },
    web_vitals: {
      desktop: {
        lcp: "2.9s",
        fid: "221ms",
        cls: "0.44",
      },
      mobile: {
        lcp: "2.9s",
        fid: "320ms",
        cls: "0.08",
      },
    },
  },
  {
    week_number: 2,
    traffic: {
      total_views: 608776,
      top_pages: [
        { path: "/", views: 60582 },
        { path: "/blog/recipes/healthier-marry-me-chicken", views: 17662 },
        { path: "/search", views: 9629 },
        { path: "/checkout", views: 3106 },
        { path: "/brands/wolstead/wolstead-pro-steel", views: 2934 },
      ],
      browsers: [
        { name: "Chrome", views: 177523, percentage: 43.2 },
        { name: "Safari", views: 166829, percentage: 40.6 },
        { name: "Other", views: 7921, percentage: 1.9 },
        { name: "Edge", views: 17200, percentage: 4.2 },
        { name: "Firefox", views: 28652, percentage: 7.0 },
        { name: "Samsung Internet", views: 12849, percentage: 3.1 },
      ],
    },
    reliability: {
      failed_requests: 579,
      error_rate: "0.0951%",
      top_failed_pages: [
        {
          path: "/frontastic/action/wishlist/addItemsToWishlist",
          failures: 194,
          status: 400,
        },
        {
          path: "/status/extensionrunner",
          failures: 164,
          status: 500,
        },
        {
          path: "/frontastic/action/checkout/validatestock",
          failures: 116,
          status: 409,
        },
        {
          path: "/frontastic/action/cart/AddDiscount",
          failures: 68,
          status: 409,
        },
        {
          path: "/{kitchenwarehouse-prod}/shipping-methods",
          failures: 34,
          status: 503,
        },
        { path: "/products/list", failures: 3, status: 500 },
      ],
    },
    ecommerce: {
      total_orders: 9128,
      payment_failures_declined: 2,
      payment_failures_approved: 17,
      active_carts: 635925,
    },
    customers: {
      first_time_buyers: 494,
      returning_customers: 202,
      guest_checkouts: 2633,
      registered_user_orders: 6495,
      total_registered_users: 1376,
      conversion_rate: "2.79%",
    },
    web_vitals: {
      desktop: {
        lcp: "2.5s",
        fid: "200ms",
        cls: "0.1",
      },
      mobile: {
        lcp: "2.5s",
        fid: "200ms",
        cls: "0.1",
      },
    },
  },
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
      error_rate: "0.0550%",
      top_failed_pages: [
        {
          path: "/status/extensionrunner",
          failures: 167,
          status: 500,
        },
        { path: "/checkout/validatestock", failures: 163, status: 400 },
        { path: "/frontastic/page", failures: 11, status: 503 },
        { path: "/ct-auth/getAnonymousAccessToken", failures: 7, status: 500 },
        { path: "/products/list", failures: 4, status: 500 },
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
      returning_customers: 237,
      guest_checkouts: 2801,
      registered_user_orders: 6920,
      total_registered_users: 1424,
      conversion_rate: "1.9%",
    },
    web_vitals: {
      desktop: {
        lcp: "2.5s",
        fid: "200ms",
        cls: "0.1",
      },
      mobile: {
        lcp: "2.5s",
        fid: "200ms",
        cls: "0.1",
      },
    },
  },
];
