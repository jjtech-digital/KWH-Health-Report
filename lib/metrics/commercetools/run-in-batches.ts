import "server-only"

import { CT_BATCH_GAP_MS, CT_BATCH_SIZE } from "./constants"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mapWithRetries<T, R>(
  item: T,
  index: number,
  mapper: (item: T, index: number) => Promise<R>,
  retriesPerItem: number
): Promise<R> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retriesPerItem; attempt++) {
    try {
      return await mapper(item, index)
    } catch (error) {
      lastError = error
      if (attempt < retriesPerItem) {
        await sleep(500 * (attempt + 1))
      }
    }
  }

  throw lastError
}

export async function runInBatches<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  options?: {
    batchSize?: number
    gapMs?: number
    label?: string
    retriesPerItem?: number
  }
): Promise<R[]> {
  if (items.length === 0) return []

  const batchSize = options?.batchSize ?? CT_BATCH_SIZE
  const gapMs = options?.gapMs ?? CT_BATCH_GAP_MS
  const retriesPerItem = options?.retriesPerItem ?? 0
  const results: R[] = new Array(items.length)

  for (let batchStart = 0; batchStart < items.length; batchStart += batchSize) {
    const batch = items.slice(batchStart, batchStart + batchSize)

    const batchResults = await Promise.all(
      batch.map((item, offset) => {
        const index = batchStart + offset
        if (retriesPerItem > 0) {
          return mapWithRetries(item, index, mapper, retriesPerItem)
        }
        return mapper(item, index)
      })
    )

    for (let i = 0; i < batchResults.length; i++) {
      results[batchStart + i] = batchResults[i]
    }

    if (batchStart + batchSize < items.length) {
      await sleep(gapMs)
    }
  }

  return results
}
