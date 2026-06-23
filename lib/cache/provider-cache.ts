import "server-only"

import type {
  CommercetoolsProviderEntry,
  DatadogProviderEntry,
  HumioCheckpoint,
  HumioProviderEntry,
  PopulateCursor,
  ProviderName,
} from "@/lib/types/provider-cache"
import { getRedisReady } from "./redis-client"
import {
  humioCheckpointKey,
  POPULATE_CURSOR_KEY,
  providerCacheKey,
} from "./redis-keys"

async function getJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisReady()
  const raw = await redis.get(key)
  if (!raw) return null
  return JSON.parse(raw) as T
}

async function setJson(key: string, value: unknown): Promise<void> {
  const redis = await getRedisReady()
  await redis.set(key, JSON.stringify(value))
}

async function deleteKey(key: string): Promise<void> {
  const redis = await getRedisReady()
  await redis.del(key)
}

export async function getProviderCache<T extends { status: string }>(
  year: number,
  week: number,
  provider: ProviderName
): Promise<T | null> {
  return getJson<T>(providerCacheKey(year, week, provider))
}

export async function setProviderCache<T>(
  year: number,
  week: number,
  provider: ProviderName,
  entry: T
): Promise<void> {
  await setJson(providerCacheKey(year, week, provider), entry)
}

export async function getAllProviderCaches(year: number, week: number): Promise<{
  datadog: DatadogProviderEntry | null
  commercetools: CommercetoolsProviderEntry | null
  humio: HumioProviderEntry | null
}> {
  const [datadog, commercetools, humio] = await Promise.all([
    getProviderCache<DatadogProviderEntry>(year, week, "datadog"),
    getProviderCache<CommercetoolsProviderEntry>(year, week, "commercetools"),
    getProviderCache<HumioProviderEntry>(year, week, "humio"),
  ])
  return { datadog, commercetools, humio }
}

export async function getHumioCheckpoint(
  year: number,
  week: number
): Promise<HumioCheckpoint | null> {
  return getJson<HumioCheckpoint>(humioCheckpointKey(year, week))
}

export async function setHumioCheckpoint(
  year: number,
  week: number,
  checkpoint: HumioCheckpoint
): Promise<void> {
  await setJson(humioCheckpointKey(year, week), checkpoint)
}

export async function deleteHumioCheckpoint(year: number, week: number): Promise<void> {
  await deleteKey(humioCheckpointKey(year, week))
}

export async function getPopulateCursor(): Promise<PopulateCursor | null> {
  return getJson<PopulateCursor>(POPULATE_CURSOR_KEY)
}

export async function setPopulateCursor(cursor: PopulateCursor | null): Promise<void> {
  if (cursor === null) {
    await deleteKey(POPULATE_CURSOR_KEY)
    return
  }
  await setJson(POPULATE_CURSOR_KEY, cursor)
}

export function isProviderReady(
  entry: { status: string } | null | undefined
): entry is { status: "ready" } {
  return entry?.status === "ready"
}
