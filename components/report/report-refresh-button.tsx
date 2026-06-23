"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

interface ReportRefreshButtonProps {
  year: number
  week: number
}

const POLL_MS = 3_000
const POLL_MAX_MS = 120_000

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function ReportRefreshButton({ year, week }: Readonly<ReportRefreshButtonProps>) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "in_progress">("idle")
  const [error, setError] = useState<string | null>(null)

  async function pollUntilReady(): Promise<boolean> {
    const deadline = Date.now() + POLL_MAX_MS

    while (Date.now() < deadline) {
      await sleep(POLL_MS)
      const res = await fetch(`/api/reports/${year}/w${week}/refresh`, { method: "POST" })
      if (res.status === 409) continue
      if (!res.ok) return false

      const body = (await res.json()) as { status?: string; cacheable?: boolean }
      if (body.status === "ready" && body.cacheable) {
        return true
      }
    }

    return false
  }

  async function onRefresh() {
    setError(null)
    setState("loading")

    try {
      const res = await fetch(`/api/reports/${year}/w${week}/refresh`, { method: "POST" })

      if (res.status === 409) {
        setState("in_progress")
        const ready = await pollUntilReady()
        setState("idle")
        if (ready) {
          router.refresh()
        } else {
          setError("Refresh still in progress")
        }
        return
      }

      if (res.status === 202) {
        setState("in_progress")
        const ready = await pollUntilReady()
        setState("idle")
        if (ready) {
          router.refresh()
        } else {
          setError("Refresh timed out — try again or run cache:populate")
        }
        return
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? "Refresh failed")
        setState("idle")
        return
      }

      setState("idle")
      router.refresh()
    } catch {
      setError("Refresh failed")
      setState("idle")
    }
  }

  const disabled = state !== "idle"
  const label =
    state === "loading" ? "Refreshing…" : state === "in_progress" ? "In progress…" : "Refresh"

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        aria-busy={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
        {label}
      </button>
      {error ? <span className="text-[10px] text-destructive max-w-[140px] text-right">{error}</span> : null}
    </div>
  )
}
