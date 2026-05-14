import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  return NextResponse.json({
    origin: req.nextUrl.origin,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    detectedRedirectUri: `${(process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "")}/api/google/callback`
  })
}
