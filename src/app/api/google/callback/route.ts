import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { reviewSources } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAdapter } from "@/lib/portals"
import { storePortalSecret } from "@/lib/aws/secrets-manager"

// GET /api/google/callback?code=...&state=...
// A dedicated short route for Google My Business OAuth
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code    = searchParams.get("code")
  const state   = searchParams.get("state")
  const error   = searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

  if (error) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=missing_params`)
  }

  try {
    // Decode state — { tenantId, sourceId }
    const { tenantId, sourceId } = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8"),
    ) as { tenantId: string; sourceId: string }

    const platform = "GOOGLE_MY_BUSINESS"
    const adapter  = getAdapter(platform)

    if (!adapter.exchangeOAuthCode) {
      return NextResponse.redirect(`${appUrl}/integrations?error=oauth_not_supported`)
    }

    // Exchange code for tokens
    // Force origin to the Railway URL for consistency
    const origin = appUrl.includes("railway.app") ? "https://adaptable-success-production.up.railway.app" : req.nextUrl.origin
    const tokens = await adapter.exchangeOAuthCode(code, origin)

    // Store in Secrets Manager
    const secretArn = await storePortalSecret(tenantId, sourceId, platform, {
      type:         "OAUTH",
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt:    tokens.expiresAt.toISOString(),
      tokenType:    tokens.tokenType,
      scope:        tokens.scope,
    })

    // Update source record
    let config: Record<string, string> = {}
    let locationName: string | null = null
    let locationId: string | null = null

    if ((adapter as any).discoverLocations) {
      try {
        const locations = await (adapter as any).discoverLocations(tokens.accessToken)
        if (locations.length > 0) {
          const first = locations[0]
          locationId   = first.locationId
          locationName = first.locationName
          config = {
            accountId:    first.accountId,
            locationId:   first.locationId,
            locationName: first.locationName,
          }
        }
      } catch (locErr) {
        console.warn("Could not discover GMB locations:", locErr)
      }
      if (!locationName) {
        locationName = tokens.externalAccountId ?? "My Business"
        locationId   = "default"
        config = { accountId: "default", locationId: "default", locationName }
      }
    }

    try {
      await db
        .update(reviewSources)
        .set({
          secretArn,
          status:              "ACTIVE",
          tokenExpiresAt:      tokens.expiresAt,
          externalAccountId:   tokens.externalAccountId,
          oauthScopes:         tokens.scope.split(" "),
          locationId:          locationId ?? undefined,
          locationName:        locationName ?? undefined,
          config,
          updatedAt:           new Date(),
        })
        .where(eq(reviewSources.id, sourceId))
    } catch (dbErr) {
      const { saveLocalSource } = require("@/lib/local-storage")
      saveLocalSource({
        id:                sourceId,
        tenantId,
        platform,
        authMode:          "OAUTH",
        displayName:       "Google My Business",
        status:            "ACTIVE",
        externalAccountId: tokens.externalAccountId,
        locationId,
        locationName,
        lastSyncAt:        new Date().toISOString(),
      })
    }

    return NextResponse.redirect(`${appUrl}/integrations?connected=GOOGLE&sourceId=${sourceId}`)
  } catch (err: any) {
    console.error("Short OAuth callback error:", err?.message || err)
    return NextResponse.redirect(`${appUrl}/integrations?error=oauth_failed`)
  }
}
