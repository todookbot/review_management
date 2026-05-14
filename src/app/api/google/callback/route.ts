import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { reviewSources } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAdapter } from "@/lib/portals"
import { storePortalSecret } from "@/lib/aws/secrets-manager"
import { saveLocalSource, saveLocalToken } from "@/lib/local-storage"
import clientPromise from "@/lib/mongodb"

// GET /api/google/callback?code=...&state=...
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code    = searchParams.get("code")
  const state   = searchParams.get("state")
  const error   = searchParams.get("error")

  // Always use Railway URL in production, otherwise use current origin
  const appUrl = req.nextUrl.origin.includes("railway.app")
    ? "https://adaptable-success-production.up.railway.app"
    : (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin)

  if (error) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    console.error("[Google Callback] Missing code or state:", { code: !!code, state: !!state })
    return NextResponse.redirect(`${appUrl}/integrations?error=missing_params`)
  }

  try {
    const { tenantId, sourceId, redirectUri: savedRedirectUri } = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8"),
    ) as { tenantId: string; sourceId: string; redirectUri?: string }

    const platform = "GOOGLE_MY_BUSINESS"
    const adapter  = getAdapter(platform)

    if (!adapter.exchangeOAuthCode) {
      return NextResponse.redirect(`${appUrl}/integrations?error=oauth_not_supported`)
    }

    // Use the EXACT redirectUri from state (same one used in OAuth URL)
    // Fall back to current origin if not available
    const exchangeOrigin = savedRedirectUri
      ? savedRedirectUri.replace("/api/google/callback", "")
      : (appUrl.includes("railway.app") ? "https://adaptable-success-production.up.railway.app" : req.nextUrl.origin)
    
    console.log(`[Google Callback] Using exchange origin: ${exchangeOrigin}`)
    const tokens = await adapter.exchangeOAuthCode(code, exchangeOrigin)

    const safeExpiresAt = (tokens.expiresAt instanceof Date && !isNaN(tokens.expiresAt.getTime()))
      ? tokens.expiresAt
      : new Date(Date.now() + 3600000)

    // Save token to MongoDB
    try {
      const client = await clientPromise;
      const dbMongo = client.db();
      const tokensCollection = dbMongo.collection("tokens");
      await tokensCollection.updateOne(
        { sourceId },
        {
          $set: {
            accessToken:  tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt:    safeExpiresAt.toISOString(),
            tokenType:    tokens.tokenType,
            scope:        tokens.scope,
            platform:     "GOOGLE_MY_BUSINESS",
            email:        tokens.externalAccountId,
            savedAt:      new Date().toISOString()
          }
        },
        { upsert: true }
      );
      console.log("[Google Callback] Token saved to MongoDB successfully");
    } catch (mongoErr) {
      console.error("[Google Callback] Failed to save token to MongoDB:", mongoErr);
      // Fallback to local storage if MongoDB fails
      saveLocalToken(sourceId, {
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    safeExpiresAt.toISOString(),
        tokenType:    tokens.tokenType,
        scope:        tokens.scope,
        platform:     "GOOGLE_MY_BUSINESS",
        email:        tokens.externalAccountId,
      })
    }

    // Try to store in Secrets Manager (may fail if AWS not configured)
    let secretArn = "local"
    try {
      secretArn = await storePortalSecret(tenantId, sourceId, platform, {
        type:         "OAUTH",
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    safeExpiresAt.toISOString(),
        tokenType:    tokens.tokenType,
        scope:        tokens.scope,
      })
    } catch (awsErr) {
      console.warn("[Google Callback] AWS Secrets Manager unavailable, using local storage:", awsErr)
    }

    // Discover locations
    let config: Record<string, string> = {}
    let locationName: string | null = null
    let locationId: string | null = null

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
      console.warn("[Google Callback] Could not discover locations:", locErr)
    }

    if (!locationName) {
      locationName = tokens.externalAccountId ?? "My Business"
      locationId   = "default"
      config = { accountId: "default", locationId: "default", locationName }
    }

    // Try to update DB
    try {
      await db.update(reviewSources)
        .set({
          secretArn,
          status:            "ACTIVE",
          tokenExpiresAt:    safeExpiresAt,
          externalAccountId: tokens.externalAccountId,
          oauthScopes:       tokens.scope?.split(" ") ?? [],
          locationId:        locationId ?? undefined,
          locationName:      locationName ?? undefined,
          config,
          updatedAt:         new Date(),
        })
        .where(eq(reviewSources.id, sourceId))
    } catch (dbErr) {
      console.warn("[Google Callback] Postgres DB unavailable, saving source to MongoDB")
      
      const newSource = {
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
      };

      try {
        const client = await clientPromise;
        const dbMongo = client.db();
        const sourcesCollection = dbMongo.collection("sources");
        await sourcesCollection.updateOne(
          { id: sourceId },
          { $set: newSource },
          { upsert: true }
        );
      } catch (mongoErr) {
        console.error("[Google Callback] Failed to save source to MongoDB, using local storage fallback", mongoErr)
        saveLocalSource(newSource)
      }
    }

    return NextResponse.redirect(`${appUrl}/integrations?connected=GOOGLE&sourceId=${sourceId}`)
  } catch (err: any) {
    console.error("[Google Callback] Error:", err?.message || err)
    return NextResponse.redirect(`${appUrl}/integrations?error=oauth_failed`)
  }
}
