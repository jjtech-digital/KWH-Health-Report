import { NextResponse } from "next/server"
import {
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth/session"

export async function POST(request: Request) {
  const passwordConfigured = Boolean(process.env.KWH_HEALTH_REPORT_PASSWORD?.trim())
  if (!passwordConfigured) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 503 })
  }

  let body: { password?: string }
  try {
    body = (await request.json()) as { password?: string }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.password || !verifyPassword(body.password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const token = createSessionToken()
  const response = NextResponse.json({ success: true })
  const cookie = sessionCookieOptions(token)
  response.cookies.set(cookie)

  return response
}
