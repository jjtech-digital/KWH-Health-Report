# Kitchen Warehouse - Platform Health Report Dashboard

A weekly platform health monitoring dashboard built for [Kitchen Warehouse](https://www.kitchenwarehouse.com.au), providing at-a-glance visibility into website performance, traffic, system reliability, e-commerce activity, and customer engagement.

## Dashboard Sections

### 1. Traffic Overview
- **Total Page Views** displayed as a headline metric (125,400 weekly views).
- **Views by Browser** - a color-coded stacked bar chart breaking down traffic across Chrome, Safari, Firefox, Edge, Samsung Internet, and other browsers with percentage labels.
- **Top 5 Pages** - ranked list of the most visited pages with proportional progress bars showing relative traffic volume.

### 2. System Health
- **Failed Requests** count with an amber/red warning indicator when failures are detected.
- **Error Rate** badge showing the percentage of failed requests (e.g., 0.08%).
- **Top 5 Failed Requests** - a detailed list of the most problematic endpoints, including HTTP status codes (500, 502, 503, 504) and failure counts with visual progress bars.

### 3. Customers & Registered Orders
- **New Customers** - count of newly registered users during the reporting period.
- **Returning Customers** - repeat purchasers.
- **Guest Checkouts** - orders placed without an account.
- **Registered User Orders** - orders placed by logged-in users.
- **Total Registered Users** - overall user base size.
- **Conversion Rate** - percentage of visitors who completed a purchase.

### 4. E-commerce Stats
- **Total Orders** - aggregate order count with a shopping bag icon.
- **Payment Failures** - failed payment attempts highlighted in red with an alert icon.
- **Active Carts** - number of carts currently containing line items.

### 5. Core Web Vitals
- **LCP (Largest Contentful Paint)** - loading performance metric.
- **FID (First Input Delay)** - interactivity metric.
- **CLS (Cumulative Layout Shift)** - visual stability metric.
- Uses a traffic-light color system: Green (good), Yellow (needs improvement), Red (poor) based on Google's recommended thresholds.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) with custom design tokens
- **Icons**: [Lucide React](https://lucide.dev/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) component primitives
- **Fonts**: Geist Sans and Geist Mono via `next/font/google`

## Project Structure

```
app/
  layout.tsx          # Root layout with fonts, metadata, and global styles
  page.tsx            # Main dashboard page composing all sections
  globals.css         # Tailwind base styles and CSS design tokens

components/
  kw-logo.tsx         # Kitchen Warehouse logo component
  traffic-overview.tsx # Traffic stats, browser breakdown, and top pages
  system-health.tsx   # Failed requests and error rate monitoring
  customer-orders.tsx # Customer engagement and registered user metrics
  ecommerce-stats.tsx # Orders, payment failures, and active carts
  web-vitals.tsx      # Core Web Vitals with traffic-light indicators

lib/
  data.ts             # Static health report data (JSON-based)
  utils.ts            # Utility functions (cn class merger)

public/
  images/
    kw-logo.png       # Kitchen Warehouse brand logo
```

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/jjtech-digital/KWH-Platform-HealthReport.git
cd KWH-Platform-HealthReport

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Build for Production

```bash
pnpm build
pnpm start
```

## Deployment

This project is configured for deployment on [Vercel](https://vercel.com). Push to the connected branch and Vercel will automatically build and deploy.

## Branding

The dashboard uses Kitchen Warehouse's brand identity:
- **Primary Color**: KW Red (`hsl(0 78% 42%)`)
- **Background**: Light neutral (`hsl(0 0% 96%)`)
- **Cards**: White (`hsl(0 0% 100%)`)
- **Typography**: Geist Sans (headings and body), Geist Mono (data values and paths)

## Data Source

Currently, the dashboard renders static data from `lib/data.ts`. This can be extended to pull from a live API, database, or analytics platform by replacing the static exports with server-side data fetching in the page or component level.
