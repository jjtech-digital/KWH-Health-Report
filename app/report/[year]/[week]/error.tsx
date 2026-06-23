"use client"

import Link from "next/link"

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <h1 className="text-lg font-bold tracking-tight text-card-foreground">
            Unable to load report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Retry
            </button>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 text-sm font-semibold text-secondary-foreground"
            >
              Back to reports
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
