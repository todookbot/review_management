import { BasePortalAdapter, type NormalizedReview } from "./base-adapter"
import type { PortalSecret, ApiKeySecret } from "@/lib/aws/secrets-manager"

export class AmazonAdapter extends BasePortalAdapter {
  readonly platform    = "AMAZON"
  readonly displayName = "Amazon Seller"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    // Amazon SP-API uses LWA (Login With Amazon) + Selling Partner credentials
    // We validate by hitting the sellers endpoint
    try {
      const res = await fetch(
        `https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations`,
        {
          headers: {
            "x-amz-access-token": apiKey,
            "Content-Type":       "application/json",
          },
        },
      )
      return res.status !== 401
    } catch {
      return false
    }
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const asin       = config.productId
    const marketplace = config.marketplaceId ?? "ATVPDKIKX0DER" // US

    // Amazon Product Reviews API (via SP-API)
    const params = new URLSearchParams({ asin, marketplaceId: marketplace })
    const res = await fetch(
      `https://sellingpartnerapi-na.amazon.com/products/reviews/v1/reviews?${params}`,
      { headers: { "x-amz-access-token": apiKey } },
    )
    const data = await res.json()

    return (data.reviews ?? []).map((r: Record<string, unknown>) => ({
      externalId:  r.id as string,
      platform:    this.platform,
      authorName:  r.reviewerName as string ?? "Amazon Customer",
      rating:      r.starRating as number,
      title:       r.title as string,
      body:        r.body as string,
      reviewedAt:  new Date(r.date as string),
      productId:   asin,
      productName: config.productName,
      isVerified:  (r.verifiedPurchase as boolean) ?? false,
      metadata:    r as Record<string, unknown>,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret) {
    // Amazon does not allow seller responses via API for public reviews
    // This would open the Seller Central URL for manual action
    console.log("Amazon: manual response required for review", reviewId)
  }
}
