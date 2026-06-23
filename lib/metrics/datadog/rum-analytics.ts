import "server-only"

import type { BrowserBreakdown, DeviceVitals, TopPage, Traffic, WebVitals } from "@/lib/types/health-report"
import { datadogFetch, rumBaseQuery } from "./client"
import { emptyDeviceVitals, emptyTraffic, emptyWebVitals } from "@/lib/types/health-report"
import { metricsLog } from "@/lib/logging/metrics-logger"

interface RumAggregateResponse {
  data?: {
    buckets?: Array<{
      by?: Record<string, string>
      computes?: Record<string, number>
    }>
  }
}

function measureCountSortDesc() {
  return { type: "measure", aggregation: "count", order: "desc" }
}

function sortBucketsByCountDesc(
  buckets: Array<{ by?: Record<string, string>; computes?: Record<string, number> }>
) {
  return [...buckets].sort(
    (a, b) => (b.computes?.["c0"] ?? 0) - (a.computes?.["c0"] ?? 0)
  )
}

function buildRumBody(
  startISO: string,
  endISO: string,
  compute: Array<Record<string, unknown>>,
  groupBy?: Array<Record<string, unknown>>,
  queryOverride?: string
) {
  return {
    compute,
    filter: {
      from: startISO,
      to: endISO,
      query: queryOverride ?? rumBaseQuery(),
    },
    ...(groupBy ? { group_by: groupBy } : {}),
  }
}

async function rumAggregate(
  startISO: string,
  endISO: string,
  compute: Array<Record<string, unknown>>,
  groupBy?: Array<Record<string, unknown>>,
  queryOverride?: string
): Promise<RumAggregateResponse> {
  return datadogFetch<RumAggregateResponse>("/api/v2/rum/analytics/aggregate", {
    method: "POST",
    body: JSON.stringify(buildRumBody(startISO, endISO, compute, groupBy, queryOverride)),
  })
}

function formatLcp(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

function formatFid(ms: number): string {
  return `${Math.round(ms)}ms`
}

function formatCls(value: number): string {
  return value.toFixed(2)
}

function parseVitalsComputes(computes: Record<string, number>): DeviceVitals {
  return {
    lcp: formatLcp((computes["c0"] ?? 0) / 1_000_000_000),
    fid: formatFid((computes["c1"] ?? 0) / 1_000_000),
    cls: formatCls(computes["c2"] ?? 0),
  }
}

export async function fetchTrafficMetrics(
  startISO: string,
  endISO: string
): Promise<Traffic> {
  const query = rumBaseQuery()
  const countCompute = [{ aggregation: "count", type: "total" }]

  const [totalResult, pagesResult, browsersResult] = await Promise.allSettled([
    rumAggregate(startISO, endISO, countCompute),
    rumAggregate(startISO, endISO, countCompute, [
      {
        facet: "@view.url_path",
        limit: 5,
        sort: measureCountSortDesc(),
      },
    ]),
    rumAggregate(startISO, endISO, countCompute, [
      {
        facet: "@browser.name",
        limit: 10,
        sort: measureCountSortDesc(),
      },
    ]),
  ])

  if (totalResult.status === "rejected") {
    metricsLog.error("datadog", "RUM traffic total aggregate failed", totalResult.reason, {
      query,
      startISO,
      endISO,
    })
    return emptyTraffic()
  }

  const totalRes = totalResult.value
  const total_views = totalRes.data?.buckets?.[0]?.computes?.["c0"] ?? 0

  if (total_views === 0) {
    metricsLog.warn("datadog", "RUM traffic returned zero views", {
      query,
      startISO,
      endISO,
      bucketCount: totalRes.data?.buckets?.length ?? 0,
    })
  }

  if (pagesResult.status === "rejected") {
    metricsLog.error("datadog", "RUM top pages aggregate failed", pagesResult.reason, {
      query,
      startISO,
      endISO,
    })
  }

  if (browsersResult.status === "rejected") {
    metricsLog.error("datadog", "RUM browsers aggregate failed", browsersResult.reason, {
      query,
      startISO,
      endISO,
    })
  }

  const top_pages: TopPage[] =
    pagesResult.status === "fulfilled"
      ? sortBucketsByCountDesc(pagesResult.value.data?.buckets ?? [])
          .map((bucket) => ({
            path: bucket.by?.["@view.url_path"] ?? "/",
            views: bucket.computes?.["c0"] ?? 0,
          }))
          .filter((page) => page.views > 0)
          .slice(0, 5)
      : []

  const browserRows =
    browsersResult.status === "fulfilled"
      ? sortBucketsByCountDesc(browsersResult.value.data?.buckets ?? [])
          .map((bucket) => ({
            name: bucket.by?.["@browser.name"] ?? "Other",
            views: bucket.computes?.["c0"] ?? 0,
          }))
          .filter((row) => row.views > 0)
      : []

  const knownNames = new Set(["Chrome", "Safari", "Firefox", "Edge", "Samsung Internet"])
  const browsers: BrowserBreakdown[] = []
  let otherViews = 0

  for (const row of browserRows) {
    if (knownNames.has(row.name)) {
      browsers.push({
        name: row.name,
        views: row.views,
        percentage: total_views > 0 ? Number(((row.views / total_views) * 100).toFixed(2)) : 0,
      })
    } else {
      otherViews += row.views
    }
  }

  if (otherViews > 0) {
    browsers.push({
      name: "Other",
      views: otherViews,
      percentage: total_views > 0 ? Number(((otherViews / total_views) * 100).toFixed(2)) : 0,
    })
  }

  return { total_views, top_pages, browsers }
}

export async function fetchWebVitalsMetrics(
  startISO: string,
  endISO: string
): Promise<WebVitals> {
  const vitalsForDevice = async (device: "Mobile" | "Desktop"): Promise<DeviceVitals> => {
    const query = `${rumBaseQuery()} @device.type:${device}`

    const res = await rumAggregate(
      startISO,
      endISO,
      [
        { aggregation: "pc75", metric: "@view.largest_contentful_paint", type: "total" },
        { aggregation: "pc75", metric: "@view.first_input_delay", type: "total" },
        { aggregation: "pc75", metric: "@view.cumulative_layout_shift", type: "total" },
      ],
      undefined,
      query
    )

    const computes = res.data?.buckets?.[0]?.computes ?? {}
    const bucketCount = res.data?.buckets?.length ?? 0

    if (bucketCount === 0 || Object.keys(computes).length === 0) {
      metricsLog.warn("datadog", "RUM web vitals returned empty buckets", {
        query,
        startISO,
        endISO,
        device,
        bucketCount,
      })
      return emptyDeviceVitals()
    }

    return parseVitalsComputes(computes)
  }

  try {
    const [mobile, desktop] = await Promise.all([
      vitalsForDevice("Mobile"),
      vitalsForDevice("Desktop"),
    ])

    return { mobile, desktop }
  } catch (error) {
    metricsLog.error("datadog", "RUM web vitals aggregate failed", error, {
      startISO,
      endISO,
    })
    return emptyWebVitals()
  }
}
