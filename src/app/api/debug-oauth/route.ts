import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "")
  const redirectUri = `${appUrl}/api/google/callback`
  
  // Mock state for debug
  const state = Buffer.from(JSON.stringify({ tenantId: "debug", sourceId: "debug" })).toString("base64url")
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "MISSING"
  
  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}`

  return NextResponse.json({
    origin: req.nextUrl.origin,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    detectedRedirectUri: redirectUri,
    googleClientId: clientId.substring(0, 10) + "...",
    fullGeneratedGoogleUrl: googleUrl
  })
}
