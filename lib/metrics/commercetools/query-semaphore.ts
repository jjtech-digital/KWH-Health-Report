import "server-only"

import { CT_MAX_CONCURRENT_JOBS } from "./constants"

let activeJobs = 0
const waitQueue: Array<() => void> = []

function releaseSlot(): void {
  activeJobs -= 1
  const next = waitQueue.shift()
  if (next) next()
}

function acquireSlot(): Promise<void> {
  if (activeJobs < CT_MAX_CONCURRENT_JOBS) {
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

export async function withCtQuerySlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    return await fn()
  } finally {
    releaseSlot()
  }
}
