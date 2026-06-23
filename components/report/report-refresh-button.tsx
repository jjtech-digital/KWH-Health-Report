"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

interface ReportRefreshButtonProps {
  year: number
  week: number
}

export function ReportRefreshButton({ year, week }: Readonly<ReportRefreshButtonProps>) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "in_progress">("idle")
  const [error, setError] = useState<string | null>(null)

  async function onRefresh() {
    setError(null)
    setState("loading")

    try {
      const res = await fetch(`/api/reports/${year}/w${week}/refresh`, { method: "POST" })

      if (res.status === 409) {
        setState("in_progress")
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
