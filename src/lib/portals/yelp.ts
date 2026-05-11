import { BasePortalAdapter, type NormalizedReview } from "./base-adapter"
import type { PortalSecret, ApiKeySecret } from "@/lib/aws/secrets-manager"
import crypto from "crypto"

export class YelpAdapter extends BasePortalAdapter {
  readonly platform    = "YELP"
  readonly displayName = "Yelp"
  readonly authModes   = ["API_KEY", "WEBHOOK"] as const

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch("https://api.yelp.com/v3/businesses/search?location=NYC&limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const businessId = config.locationId

    const res = await fetch(
      `https://api.yelp.com/v3/businesses/${businessId}/reviews?limit=50`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    const data = await res.json()
    return (data.reviews ?? []).map((r: Record<string, unknown>) => ({
      externalId:   r.id as string,
      platform:     this.platform,
      authorName:   (r.user as Record<string, string>)?.name ?? "Anonymous",
      authorAvatar: (r.user as Record<string, string>)?.image_url,
      rating:       r.rating as number,
      body:         r.text as string,
      reviewedAt:   new Date(r.time_created as string),
      locationId:   businessId,
      locationName: config.locationName,
      isVerified:   false,
      metadata:     r as Record<string, unknown>,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret) {
    // Yelp Business API — response endpoint
    const { apiKey } = secret as ApiKeySecret
    await fetch(`https://api.yelp.com/v3/businesses/reviews/${reviewId}/comments`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: response }),
    })
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expected}`),
    )
  }

  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedReview | null {
    if (payload.type !== "review") return null
    const r = payload.data as Record<string, unknown>
    return {
      externalId:  r.review_id as string,
      platform:    this.platform,
      authorName:  (r.user as Record<string, string>)?.name ?? "Anonymous",
      rating:      r.rating as number,
      body:        r.text as string,
      reviewedAt:  new Date(r.time_created as string),
      isVerified:  false,
      metadata:    r,
    }
  }
}
