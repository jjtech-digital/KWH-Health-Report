import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./constants"

function getSessionSecret(): string {
  const secret = process.env.KWH_HEALTH_REPORT_PASSWORD?.trim()
  if (!secret) {
    throw new Error("KWH_HEALTH_REPORT_PASSWORD is not configured")
  }
  return secret
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url")
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url")
  return `${payload}.${signPayload(payload)}`
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false

  try {
    if (!process.env.KWH_HEALTH_REPORT_PASSWORD?.trim()) return false
  } catch {
    return false
  }

  const [payload, signature] = token.split(".")
  if (!payload || !signature) return false

  const expected = signPayload(payload)
  const sigBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expected)

  if (sigBuf.length !== expectedBuf.length) return false
  if (!timingSafeEqual(sigBuf, expectedBuf)) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      exp?: number
    }
    return typeof parsed.exp === "number" && parsed.exp > Date.now()
  } catch {
    return false
  }
}

export function verifySessionTokenSafe(token: string | undefined): boolean {
  try {
    return verifySessionToken(token)
  } catch {
    return false
  }
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.KWH_HEALTH_REPORT_PASSWORD?.trim()
  if (!expected) return false

  const inputBuf = Buffer.from(password.trim())
  const expectedBuf = Buffer.from(expected)

  if (inputBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(inputBuf, expectedBuf)
}

export async function getSessionFromCookies(): Promise<boolean> {
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}
