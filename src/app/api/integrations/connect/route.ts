import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { reviewSources } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAdapter } from "@/lib/portals"
import { storePortalSecret } from "@/lib/aws/secrets-manager"
import { z } from "zod"
import crypto from "crypto"

const connectSchema = z.discriminatedUnion("authMode", [
  z.object({
    authMode:     z.literal("API_KEY"),
    tenantId:     z.string().uuid(),
    platform:     z.string(),
    displayName:  z.string(),
    apiKey:       z.string().min(1),
    locationId:   z.string().optional(),
    locationName: z.string().optional(),
    productId:    z.string().optional(),
    productName:  z.string().optional(),
    config:       z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    authMode:     z.literal("OAUTH"),
    tenantId:     z.string().uuid(),
    platform:     z.string(),
    displayName:  z.string(),
    locationId:   z.string().optional(),
    locationName: z.string().optional(),
    productId:    z.string().optional(),
    productName:  z.string().optional(),
  }),
  z.object({
    authMode:     z.literal("WEBHOOK"),
    tenantId:     z.string().uuid(),
    platform:     z.string(),
    displayName:  z.string(),
    locationId:   z.string().optional(),
    locationName: z.string().optional(),
  }),
])

// POST /api/integrations/connect — create a new source connection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = connectSchema.parse(body)

    const adapter = getAdapter(data.platform)

    if (data.authMode === "API_KEY") {
      // Validate the API key first
      const isValid = await adapter.validateApiKey(
        data.apiKey,
        data.config as Record<string, string> | undefined,
      )
      if (!isValid) {
        return NextResponse.json({ error: "Invalid API key — validation failed" }, { status: 400 })
      }

      // Create a temp source record to get the ID for Secrets Manager naming
      const sourceId = crypto.randomUUID()

      // Store in Secrets Manager
      const secretArn = await storePortalSecret(
        data.tenantId,
        sourceId,
        data.platform,
        { type: "API_KEY", apiKey: data.apiKey },
      )

      // Save source to DB
      const [source] = await db
        .insert(reviewSources)
        .values({
          tenantId:     data.tenantId,
          platform:     data.platform as "GOOGLE_MY_BUSINESS",
          authMode:     "API_KEY",
          displayName:  data.displayName,
          locationId:   data.locationId,
          locationName: data.locationName,
          productId:    data.productId,
          productName:  data.productName,
          secretArn,
          status:       "ACTIVE",
          config:       (data.config ?? {}) as Record<string, string>,
        })
        .returning()

      return NextResponse.json({ source, status: "connected" })
    }

    if (data.authMode === "OAUTH") {
      // Return OAuth authorization URL — frontend will redirect user
      if (!adapter.buildOAuthUrl) {
        return NextResponse.json({ error: "Platform does not support OAuth" }, { status: 400 })
      }

      let source = null
      let sourceId: string = crypto.randomUUID()
      try {
        // Store pending source in DB
        const result = await db
          .insert(reviewSources)
          .values({
            tenantId:     data.tenantId,
            platform:     data.platform as "GOOGLE_MY_BUSINESS",
            authMode:     "OAUTH",
            displayName:  data.displayName,
            locationId:   data.locationId,
            locationName: data.locationName,
            status:       "PENDING_AUTH",
          })
          .returning()
        source = result[0]
        sourceId = source.id
      } catch (dbErr) {
        console.warn("DB insert failed, continuing with mock sourceId:", sourceId)
        // Fallback: save to local storage
        const { saveLocalSource } = require("@/lib/local-storage")
        source = {
          id:           sourceId,
          tenantId:     data.tenantId,
          platform:     data.platform,
          authMode:     "OAUTH",
          displayName:  data.displayName,
          status:       "PENDING_AUTH",
          createdAt:    new Date().toISOString(),
        }
        saveLocalSource(source)
      }

      // State encodes tenantId + sourceId for the callback
      const state = Buffer.from(
        JSON.stringify({ tenantId: data.tenantId, sourceId }),
      ).toString("base64url")

      const authUrl = adapter.buildOAuthUrl(state)

      return NextResponse.json({ source, authUrl, status: "oauth_pending" })
    }

    if (data.authMode === "WEBHOOK") {
      const webhookSecret = crypto.randomBytes(32).toString("hex")
      const sourceId      = crypto.randomUUID()
      const webhookUrl    = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${data.tenantId}/${sourceId}`

      const [source] = await db
        .insert(reviewSources)
        .values({
          id:            sourceId,
          tenantId:      data.tenantId,
          platform:      data.platform as "YELP",
          authMode:      "WEBHOOK",
          displayName:   data.displayName,
          locationId:    data.locationId,
          locationName:  data.locationName,
          webhookSecret,
          webhookUrl,
          status:        "ACTIVE",
        })
        .returning()

      return NextResponse.json({
        source,
        webhookUrl,
        webhookSecret,
        status: "connected",
        instructions: `Configure this webhook URL in your ${data.platform} dashboard. Use the secret for HMAC-SHA256 signature verification.`,
      })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to connect" }, { status: 500 })
  }
}
