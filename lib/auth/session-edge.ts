const SESSION_COOKIE_NAME = "kwh-health-report-session"

function getSecret(): string | null {
  return process.env.KWH_HEALTH_REPORT_PASSWORD?.trim() ?? null
}

async function signPayloadEdge(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return Buffer.from(new Uint8Array(signature)).toString("base64url")
}

export async function verifySessionTokenEdge(token: string | undefined): Promise<boolean> {
  if (!token) return false

  const secret = getSecret()
  if (!secret) return false

  const [payload, signature] = token.split(".")
  if (!payload || !signature) return false

  const expected = await signPayloadEdge(payload, secret)
  if (signature.length !== expected.length) return false

  let mismatch = 0
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      exp?: number
    }
    return typeof parsed.exp === "number" && parsed.exp > Date.now()
  } catch {
    return false
  }
}

export { SESSION_COOKIE_NAME }
