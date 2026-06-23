import "server-only"

import { RedisCacheAdapter } from "./adapters/redis-cache"
import type { ReportCachePort } from "./report-cache-port"

let cacheInstance: ReportCachePort | null = null

export function getReportCache(): ReportCachePort {
  if (cacheInstance) return cacheInstance
  cacheInstance = new RedisCacheAdapter()
  return cacheInstance
}
