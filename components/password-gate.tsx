"use client"

import { useEffect, useId, useRef, useState } from "react"
import { KWLogo } from "@/components/kw-logo"

const AUTH_STORAGE_KEY = "kwh-health-report:unlocked"
const PASSWORD_ENV_KEY = "NEXT_PUBLIC_KWH_HEALTH_REPORT"
const EXPECTED_PASSWORD = (process.env.NEXT_PUBLIC_KWH_HEALTH_REPORT ?? "").trim()

type GateState = "checking" | "locked" | "unlocked" | "misconfigured"

function readUnlockedFlag(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(AUTH_STORAGE_KEY) === "1"
    )
  } catch {
    return false
  }
}

function writeUnlockedFlag() {
  try {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, "1")
  } catch {
    // Ignore storage failures (e.g. blocked storage); session will remain in-memory.
  }
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const expectedPassword = EXPECTED_PASSWORD

  const [gateState, setGateState] = useState<GateState>(() =>
    expectedPassword ? "checking" : "misconfigured",
  )
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!expectedPassword) {
      return
    }

    setGateState(readUnlockedFlag() ? "unlocked" : "locked")
  }, [expectedPassword])

  useEffect(() => {
    if (gateState === "locked") {
      inputRef.current?.focus()
    }
  }, [gateState])

  function submit() {
    setError(null)

    if (!expectedPassword) {
      setGateState("misconfigured")
      return
    }

    if (password.trim() !== expectedPassword) {
      setError("Incorrect password. Please try again.")
      inputRef.current?.focus()
      inputRef.current?.select()
      return
    }

    writeUnlockedFlag()
    setPassword("")
    setGateState("unlocked")
  }

  if (gateState === "unlocked") {
    return <>{children}</>
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8 py-14">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-center mb-6">
            <KWLogo />
          </div>

          <h1 className="text-lg font-bold tracking-tight text-card-foreground">
            Enter password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" id={helpId}>
            This dashboard is protected.
          </p>

          {gateState === "misconfigured" ? (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-card-foreground">
              Access password is not configured. Set{" "}
              <code className="font-mono text-xs">{PASSWORD_ENV_KEY}</code>.
            </div>
          ) : (
            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={inputId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Password
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : helpId}
                  className={`h-10 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    error
                      ? "border-destructive/60 focus-visible:ring-destructive"
                      : "border-input"
                  }`}
                />
                {error ? (
                  <p
                    id={errorId}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {error}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Unlock
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
