# KWH Health Report

A weekly platform health monitoring dashboard for [Kitchen Warehouse](https://kitchenwarehouse.com.au), built with Next.js 16. The application presents key operational metrics — traffic, system reliability, e-commerce performance, customer activity, and Core Web Vitals — in a password-protected, responsive interface.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Development Server](#running-the-development-server)
  - [Building for Production](#building-for-production)
- [Report Sections](#report-sections)
  - [Traffic Overview](#traffic-overview)
  - [System Health](#system-health)
  - [E-commerce Stats](#e-commerce-stats)
  - [Customers & Orders](#customers--orders)
  - [Core Web Vitals](#core-web-vitals)
- [Routing](#routing)
- [Authentication](#authentication)
- [Styling & Theming](#styling--theming)
- [Data Layer](#data-layer)

---

## Features

- **Password-protected access** — dashboard is gated behind a configurable password stored in an environment variable; session persistence via `sessionStorage`.
- **Weekly report index** — home page auto-generates a browsable list of available weeks grouped by month, with collapsible accordion sections and year tabs.
- **Five dashboard sections** — Traffic Overview, System Health, E-commerce Stats, Customer & Orders, and Core Web Vitals.
- **Responsive design** — fully adaptive layout from mobile to desktop using Tailwind CSS utility classes and responsive grid breakpoints.
- **Interactive info modals** — contextual popups explain each metric's meaning and importance.
- **Color-coded health indicators** — success / warning / destructive colour tokens surface metric status at a glance (e.g. Web Vitals thresholds, error rates).
- **Browser breakdown visualisation** — stacked bar chart with per-browser colour legend for traffic distribution.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript 5.7 |
| UI | React 19, Radix UI primitives, Lucide icons |
| Styling | Tailwind CSS 3.4, `tailwindcss-animate`, `class-variance-authority` |
| Charts | Recharts 2.15 |
| Date Handling | date-fns 4.1 |
| Form / Validation | React Hook Form, Zod, `@hookform/resolvers` |
| Misc | `next-themes`, Sonner (toasts), `cmdk`, `vaul`, `react-resizable-panels`, Embla Carousel |
| Images | Cloudinary via `next/image` remote patterns |

---

## Project Structure

```
├── app/
│   ├── globals.css            # Tailwind directives & CSS custom properties (theme tokens)
│   ├── layout.tsx             # Root layout — fonts, metadata, viewport
│   ├── page.tsx               # Home page — password gate → report index
│   └── report/
│       └── [year]/
│           └── [week]/
│               └── page.tsx   # Dynamic weekly report page
├── components/
│   ├── customer-orders.tsx    # Customer acquisition & order breakdown cards
│   ├── ecommerce-stats.tsx    # Orders, payment failures, active carts
│   ├── kw-logo.tsx            # Kitchen Warehouse logo component
│   ├── password-gate.tsx      # Client-side password authentication gate
│   ├── report-index.tsx       # Browsable month/week accordion index
│   ├── system-health.tsx      # Failed requests, error rate, top failures
│   ├── traffic-overview.tsx   # Page views, browser breakdown, top pages
│   └── web-vitals.tsx         # LCP, FID, CLS for mobile & desktop
├── lib/
│   ├── data.ts                # Static health data array (one entry per week)
│   ├── utils.ts               # Shared utilities (cn helper for classnames)
│   └── weeks.ts               # Week date-range calculation & report index generation
├── public/
│   └── images/                # Static assets (logo, etc.)
├── next.config.mjs            # Next.js config — Cloudinary remote image pattern
├── tailwind.config.ts         # Tailwind theme extensions (shadcn/ui design tokens)
├── tsconfig.json              # TypeScript compiler options
└── package.json               # Dependencies & scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **pnpm** (recommended — lockfile is `pnpm-lock.yaml`)

### Installation

```bash
yarn install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_KWH_HEALTH_REPORT=your_password_here
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_KWH_HEALTH_REPORT` | Yes | The password users must enter to access the dashboard. If unset, the app shows a "misconfigured" notice. |

### Running the Development Server

```bash
yarn run dev
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
yarn run build
yarn run start
```

### Linting

```bash
yarn run lint
```

---

## Report Sections

Each weekly report page (`/report/{year}/w{week}`) renders five dashboard sections:

### Traffic Overview

Displays the week's **total page views**, a **stacked bar chart** of browser distribution (Chrome, Safari, Firefox, Edge, Samsung Internet, Other) with an interactive legend, and a ranked list of the **top 5 most-visited pages** with proportional fill bars.

### System Health

Shows **failed request count**, overall **error rate**, and a ranked breakdown of the **top 5 failing endpoints** including HTTP status codes and failure counts. A colour-coded status indicator at the bottom summarises operational health.

### E-commerce Stats

Four metric cards covering **Total Orders**, **Payment Failures (Declined)**, **Payment Failures (Approved)**, and **Active Carts**. Each card has an info button opening a modal that explains the metric and why it matters.

### Customers & Orders

Six cards tracking **New Customers** (first-time buyers), **Returning Customers**, **Guest Checkouts**, **Registered User Orders**, **Total Registered Users**, and **Conversion Rate**. Each metric includes a brief description and a detailed info modal.

### Core Web Vitals

Separate panels for **Mobile** and **Desktop** showing the three Core Web Vitals — **LCP** (Largest Contentful Paint), **FID** (First Input Delay), and **CLS** (Cumulative Layout Shift). Each metric is colour-coded against Google's thresholds (Good / Needs Improvement / Poor) with the target value displayed.

---

## Routing

| Route | Description |
|-------|-------------|
| `/` | Home page — shows a filterable, year-tabbed index of all available weekly reports. |
| `/report/[year]/w[week]` | Individual weekly report dashboard (e.g. `/report/2026/w5`). |

Dynamic route parameters (`year`, `week`) are parsed client-side from `useParams()`. Invalid routes show a fallback error card with a link back to the index.

---

## Authentication

The dashboard is protected by a lightweight **client-side password gate** (`PasswordGate` component):

1. On load, the gate checks `sessionStorage` for a previously unlocked flag.
2. If not found, a password form is displayed.
3. The entered password is compared against the `NEXT_PUBLIC_KWH_HEALTH_REPORT` environment variable.
4. On success, a flag is stored in `sessionStorage` so the user remains unlocked for the browser session.

> **Note:** This is a client-side gate suitable for internal/low-sensitivity dashboards. The password is embedded in the client bundle via the `NEXT_PUBLIC_` prefix. Do not use this for securing sensitive data.

---

## Styling & Theming

- **Tailwind CSS** with a custom design-token system using CSS custom properties defined in `globals.css`.
- Token palette includes `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`, `--border`, `--input`, and `--ring`.
- Dark mode support is configured (`darkMode: ["class"]`) but the app currently ships a single light theme.
- **Radix UI** primitives are installed for accessible, unstyled component foundations (dialog, accordion, tabs, tooltip, etc.).
- `cn()` utility (from `lib/utils.ts`) merges `clsx` and `tailwind-merge` for conditional class composition.

---

## Data Layer

All report data lives in `lib/data.ts` as a static TypeScript array (`healthData`). Each entry is keyed by `week_number` and contains:

```ts
{
  week_number: number
  traffic: { total_views, top_pages[], browsers[] }
  reliability: { failed_requests, error_rate, top_failed_pages[] }
  ecommerce: { total_orders, payment_failures_declined, payment_failures_approved, active_carts }
  customers: { first_time_buyers, returning_customers, guest_checkouts, registered_user_orders, total_registered_users, conversion_rate }
  web_vitals: { desktop: { lcp, fid, cls }, mobile: { lcp, fid, cls } }
}
```

Week date ranges are calculated dynamically in `lib/weeks.ts` using `date-fns`, with weeks starting on Monday (ISO convention). The report index generator skips January and December and only lists weeks that have already ended.


