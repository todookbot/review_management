import { BasePortalAdapter, type NormalizedReview } from "./base-adapter"
import type { PortalSecret, ApiKeySecret } from "@/lib/aws/secrets-manager"

export class AppStoreAdapter extends BasePortalAdapter {
  readonly platform    = "APPLE_APP_STORE"
  readonly displayName = "Apple App Store"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    // App Store Connect API uses JWT — apiKey is the private key (.p8 content)
    // config should include: issuerId, keyId
    return !!(apiKey && config?.issuerId && config?.keyId)
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const appId      = config.productId

    // App Store Connect API v1
    const jwt   = await this.generateJWT(apiKey, config.issuerId, config.keyId)
    const params = new URLSearchParams({
      "filter[app]": appId,
      "sort":        "-createdDate",
      "limit":       "50",
    })

    const res = await fetch(
      `https://api.appstoreconnect.apple.com/v1/customerReviews?${params}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    )
    const data = await res.json()

    return (data.data ?? []).map((r: Record<string, unknown>) => {
      const attrs = r.attributes as Record<string, unknown>
      return {
        externalId:  r.id as string,
        platform:    this.platform,
        authorName:  attrs.reviewerNickname as string ?? "App User",
        rating:      attrs.rating as number,
        title:       attrs.title as string,
        body:        attrs.body as string,
        reviewedAt:  new Date(attrs.createdDate as string),
        productId:   appId,
        productName: config.productName,
        isVerified:  true,
        metadata:    r as Record<string, unknown>,
      }
    })
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret) {
    const { apiKey } = secret as ApiKeySecret
    // App Store Connect: POST /v1/customerReviewResponses
    console.log(`AppStore: responding to review ${reviewId}`)
  }

  private async generateJWT(privateKey: string, issuerId: string, keyId: string): Promise<string> {
    // In production, use 'jsonwebtoken' or 'jose' to sign ES256 JWT
    // Placeholder for brevity
    return `jwt-placeholder-${keyId}`
  }
}

export class GooglePlayAdapter extends BasePortalAdapter {
  readonly platform    = "GOOGLE_PLAY_STORE"
  readonly displayName = "Google Play Store"
  readonly authModes   = ["OAUTH"] as const

  async validateApiKey(): Promise<boolean> { return false }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const packageName = config.productId
    // Google Play Developer API
    const res = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/reviews?maxResults=50`,
      {
        headers: {
          Authorization: `Bearer ${(secret as { accessToken: string }).accessToken}`,
        },
      },
    )
    const data = await res.json()

    return (data.reviews ?? []).map((r: Record<string, unknown>) => {
      const comments = (r.comments as Record<string, unknown>[])?.[0]
      const userComment = (comments as Record<string, unknown>)?.userComment as Record<string, unknown>
      return {
        externalId:  r.reviewId as string,
        platform:    this.platform,
        authorName:  r.authorName as string ?? "Play User",
        rating:      userComment?.starRating as number,
        body:        userComment?.text as string,
        reviewedAt:  new Date((userComment?.lastModified as { seconds: string })?.seconds
          ? Number((userComment?.lastModified as { seconds: string }).seconds) * 1000
          : Date.now()),
        productId:   packageName,
        productName: config.productName,
        isVerified:  true,
        metadata:    r as Record<string, unknown>,
      }
    })
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret) {
    console.log(`PlayStore: responding to review ${reviewId}`)
  }
}
