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
├── middleware.ts              # Session auth guard
├── vercel.json                # Cron schedules
├── .env.example               # Required env vars template
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx               # Report index (Server Component)
│   ├── login/page.tsx
│   ├── api/
│   │   ├── auth/login/route.ts
│   │   ├── auth/logout/route.ts
│   │   ├── cron/refresh-weeks/route.ts
│   │   └── reports/[year]/[week]/route.ts
│   └── report/[year]/[week]/
│       ├── page.tsx           # Dynamic weekly report
│       ├── loading.tsx
│       └── error.tsx
├── components/
│   ├── auth/login-form.tsx
│   ├── report/                # Section components (props-based)
│   ├── report-index.tsx
│   └── kw-logo.tsx
├── data/
│   └── weeks/                 # Committed JSON snapshots (flat, year in filename)
│       ├── manifest.json      # Index: by_year → week numbers
│       └── 2026-w01.json …    # One file per concluded week
├── lib/
│   ├── types/                 # HealthReportWeek, cache, metrics types
│   ├── data/                  # Week JSON read/write + Redis snapshot helpers
│   ├── cache/                 # ReportCachePort + Next.js adapter
│   ├── metrics/
│   │   ├── commercetools/     # Lifted from fetch-kwh-data sibling
│   │   ├── humio/
│   │   └── datadog/
│   ├── services/              # Assembler, getWeekReport, cron refresh
│   ├── auth/                  # Session cookie (server + edge)
│   ├── weeks.ts
│   └── utils.ts
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

- **Node.js** 24.x (see [`.nvmrc`](.nvmrc); `nvm use`)
- **pnpm** (recommended — lockfile is `pnpm-lock.yaml`)

### Installation

```bash
yarn install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in credentials. Use **`.env` only** — do not create `.env.local`.

```bash
cp .env.example .env
```

On Vercel/production, set the same variables in the platform dashboard (the committed `.env` file is for local dev only).

| Variable | Required | Description |
|----------|----------|-------------|
| `KWH_HEALTH_REPORT_PASSWORD` | Yes | Server-side dashboard password (httpOnly session cookie) |
| `CRON_SECRET` | Yes (prod) | Bearer token for `/api/cron/*` (refresh, clear cache) |
| `CT_*` | Yes | Commercetools OAuth + GraphQL (5 vars) |
| `HUMIO_*` | Yes | Humio QueryJob API for reliability + payment metrics |
| `DATADOG_*` | Yes | Datadog AP1 RUM + Logs API |
| `DATADOG_RUM_QUERY` | No | Default `@type:view env:prod` — do not filter by `DATADOG_RUM_APPLICATION_ID` |
| `REDIS_*` | Yes | Redis cache (`REDIS_HOST`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_PORT`, `REDIS_TLS`) |

See [`.env.example`](.env.example) for the full list.

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
| `/login` | Password sign-in (redirects to `/` when authenticated) |
| `/report/[year]/w[week]` | Individual weekly report dashboard (e.g. `/report/2026/w5`) |

Report pages are **Server Components** that load data via `getWeekReport()` — Commercetools, Humio, and Datadog queries merged at runtime. Invalid routes show a fallback error card.

---

## Authentication

The dashboard uses **server-side session auth**:

1. Unauthenticated users are redirected to `/login`.
2. `POST /api/auth/login` validates the password against `KWH_HEALTH_REPORT_PASSWORD`.
3. On success, an **httpOnly cookie** is set (`kwh-health-report-session`).
4. `middleware.ts` protects `/`, `/report/*`, and `/api/reports/*`.
5. `POST /api/auth/logout` clears the session.

The password is never exposed in the client bundle.

---

## Styling & Theming

- **Tailwind CSS** with a custom design-token system using CSS custom properties defined in `globals.css`.
- Token palette includes `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`, `--border`, `--input`, and `--ring`.
- Dark mode support is configured (`darkMode: ["class"]`) but the app currently ships a single light theme.
- **Radix UI** primitives are installed for accessible, unstyled component foundations (dialog, accordion, tabs, tooltip, etc.).
- `cn()` utility (from `lib/utils.ts`) merges `clsx` and `tailwind-merge` for conditional class composition.

---

## Data Layer

Hybrid model: **current week** from live queries (Redis); **concluded weeks** from committed JSON snapshots.

| Week type | Read source | Write source |
|-----------|-------------|--------------|
| Current (in-progress) | Live queries → Redis merged cache | Cron / manual refresh (current week only) |
| Concluded (completed) | `data/weeks/{year}-w{nn}.json` + `manifest.json` (Redis snapshot bridge if file not yet deployed) | Week-end finalization copies last Redis cache → JSON (no live API queries) |

| Source | Module | Metrics |
|--------|--------|---------|
| Commercetools GraphQL | `lib/metrics/commercetools/` | Orders, carts, customers |
| Humio | `lib/metrics/humio/` | Reliability, payment failures |
| Datadog RUM + Logs | `lib/metrics/datadog/` | Traffic, web vitals, payment logs |

**Current week:** `getWeekReport()` reads Redis only — never JSON. Populated by `populateMissingWeeks()` (current week only) → per-provider Redis keys → merged `kwh-reports:week:{year}:{week}`.

**Concluded weeks:** `getWeekReport()` reads committed JSON at `data/weeks/{year}-w{nn}.json` (e.g. `2026-w11.json`). See `data/weeks/manifest.json` for the year → weeks index. Does not read live Redis merged keys or re-run provider queries. If the JSON file is not yet committed, falls back to Redis snapshot key `kwh-reports:week-snapshot:{year}:{week}`.

**How JSON files are created**

| Trigger | What happens |
|---------|----------------|
| Week rolls forward | `finalizeRecentlyConcludedWeek()` at start of each populate/cron tick copies the previous week’s cacheable Redis cache → JSON + Redis snapshot (no API queries) |
| Current week refresh completes | While the week is still current, data stays in Redis only |
| Historical bootstrap | `yarn weeks:import-historical` writes `{year}-w{nn}.json` from git |
| Manual export | `yarn weeks:snapshot -- 2026 21` copies Redis merged cache → JSON file |
| After any write | `manifest.json` is regenerated with `by_year` mapping |

On Vercel, filesystem JSON writes may be skipped (read-only FS); the Redis snapshot is written immediately. Commit the JSON file (via `yarn weeks:snapshot` locally) and deploy — after that all environments read the file directly.

**Week-end handoff:** On each populate tick, `finalizeRecentlyConcludedWeek()` copies the previous week’s last cacheable Redis merged cache into `{year}-w{nn}.json` via `persistWeekSnapshot()` — no API refetch for past weeks.

Local and Vercel use the **same env var names** and the **same `lib/` read/write code** — `.env` locally (loaded by `next.config.mjs`), Vercel dashboard in production. API routes use `runtime = "nodejs"` for Redis. Set `REDIS_TLS=false` for plain TCP Redis Cloud endpoints (default).

**Historical bootstrap (weeks 1–20):** `yarn weeks:import-historical` extracts pre-dynamic `lib/data.ts` from git commit `bd4a34c` into `data/weeks/2026/`. Optional dev seed: `yarn cache:seed-from-json` pushes JSON into live Redis merged keys (dev convenience only).

**Populate Redis cache (current week only):** `yarn cache:populate` refreshes **only the current report week** via live provider queries. Past weeks are never touched. Optional filter must match the current week: `yarn cache:populate -- 2026 21`. Uses the same `populateMissingWeeks()` service as the HTTP cron route. HTTP: `POST /api/cron/populate-cache` with `Authorization: Bearer $CRON_SECRET`. Vercel cron hits the same route via GET every **30 minutes** (`*/30 * * * *`).

**Validate JSON coverage:** `yarn weeks:validate` — exits 1 if any concluded week is missing a JSON file.

**Clear then populate:** `yarn cache:clear` wipes Redis keys; `yarn cache:populate` refills **current week only**. One week: `yarn cache:clear 2026 21` then `yarn cache:populate`.

**Cron:** Vercel cron hits `/api/cron/populate-cache` every **30 minutes**. Requires **Vercel Pro** for sub-hourly schedules (Hobby is daily-only).

Cron behaviour (all week logic uses **Australia/Sydney**):

| Action | When |
|--------|------|
| Finalize previous week → JSON | Start of each populate tick (no API queries) |
| Skip populate | Current week cache &lt; 30 min old and `cacheable` |
| Refresh current week | Current week stale or missing |

**Manual refresh:** Available for the **current week only**. Concluded weeks return JSON snapshot status — no live provider refetch.

**Clear Redis cache:** `yarn cache:clear` (all keys) or `yarn cache:clear 2026 19` (one week). Clears `week`, `provider`, `humio-checkpoint`, `refresh-lock`, and `populate-cursor` keys.

**Timeouts:** CT fast tick capped at `METRICS_CT_TIMEOUT_MS` (default 5 min). Humio uses Redis checkpoints (~270s per HTTP/cron tick, 20 min total per week). Pages use `maxDuration = 60` and never block on full assembly.

**Commercetools concurrency:** First-time-buyer lookups run at low concurrency (`CT_EMAIL_BATCH_SIZE=3`) with retries to avoid connect-timeout log floods after a cache clear. Partial CT failures keep other metrics (e.g. total orders) and mark the report non-cacheable.

```ts
interface HealthReportWeek {
  week_number: number
  year: number
  computed_at: string
  traffic: { total_views, top_pages[], browsers[] }
  reliability: { failed_requests, error_rate, top_failed_pages[] }
  ecommerce: { total_orders, payment_failures_declined, payment_failures_approved, active_carts }
  customers: { first_time_buyers, returning_customers, guest_checkouts, registered_user_orders, total_registered_users, conversion_rate }
  web_vitals: { desktop: { lcp, fid, cls }, mobile: { lcp, fid, cls } }
}
```

Week date ranges are calculated in `lib/weeks.ts` using `date-fns` and `@date-fns/tz` with timezone **`Australia/Sydney`** (Mon 00:00 – Sun 23:59:59). Metric query windows are converted to UTC ISO strings for Humio, Commercetools, and Datadog. The report index skips January and December and only lists weeks that have already ended in Sydney time.


