import "server-only"

import { HUMIO_MAX_CONCURRENT_JOBS } from "./constants"

let activeJobs = 0
const waitQueue: Array<() => void> = []

function releaseSlot(): void {
  activeJobs -= 1
  const next = waitQueue.shift()
  if (next) next()
}

function acquireSlot(): Promise<void> {
  if (activeJobs < HUMIO_MAX_CONCURRENT_JOBS) {
    activeJobs += 1
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeJobs += 1
      resolve()
    })
  })
}

export async function withHumioQuerySlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    return await fn()
  } finally {
    releaseSlot()
  }
}
