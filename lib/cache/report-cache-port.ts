import type { CachedWeekReport } from "@/lib/types/cache"

export interface ReportCachePort {
  get(year: number, week: number): Promise<CachedWeekReport | null>
  set(year: number, week: number, value: CachedWeekReport): Promise<void>
  invalidate(year: number, week: number): Promise<void>
}
