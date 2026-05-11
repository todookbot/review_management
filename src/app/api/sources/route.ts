import { NextRequest, NextResponse } from "next/server"
import { db }            from "@/db"
import { reviewSources, tenants } from "@/db/schema"
import { eq, desc }      from "drizzle-orm"

export async function GET(req: NextRequest) {
  let tenantId = req.nextUrl.searchParams.get("tenantId")

  try {
    // Fallback: first tenant (local dev without full session)
    if (!tenantId) {
      const [first] = await db.select({ id: tenants.id }).from(tenants).limit(1)
      tenantId = first?.id ?? null
    }
    if (!tenantId) return NextResponse.json({ sources: [] })

    const sources = await db
      .select({
        id:                reviewSources.id,
        platform:          reviewSources.platform,
        displayName:       reviewSources.displayName,
        authMode:          reviewSources.authMode,
        status:            reviewSources.status,
        locationName:      reviewSources.locationName,
        productName:       reviewSources.productName,
        lastSyncedAt:      reviewSources.lastSyncAt,
        lastSyncError:     reviewSources.lastSyncError,
        webhookUrl:        reviewSources.webhookUrl,
        externalAccountId: reviewSources.externalAccountId,
      })
      .from(reviewSources)
      .where(eq(reviewSources.tenantId, tenantId))
      .orderBy(desc(reviewSources.createdAt))

    return NextResponse.json({ sources })
  } catch (err) {
    console.warn("DB fetch failed, returning local storage fallback:", err)
    const { getLocalSources } = require("@/lib/local-storage")
    const localSources = getLocalSources()
    
    // Map local storage fields to match the DB query shape the frontend expects
    const mapped = localSources.map((s: any) => ({
      id:                s.id,
      platform:          s.platform ?? "GOOGLE_MY_BUSINESS",
      displayName:       s.displayName ?? s.platform,
      authMode:          s.authMode ?? "OAUTH",
      status:            s.status ?? "ACTIVE",
      locationName:      s.locationName ?? null,
      productName:       s.productName ?? null,
      lastSyncedAt:      s.lastSyncAt ?? s.lastSyncedAt ?? null,  // normalise field name
      lastSyncError:     s.lastSyncError ?? null,
      webhookUrl:        s.webhookUrl ?? null,
      externalAccountId: s.externalAccountId ?? null,
    }))

    return NextResponse.json({ sources: mapped })
  }
}
