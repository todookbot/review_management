/**
 * Additional App Store Adapter
 * Huawei AppGallery
 * (Apple App Store & Google Play are already in app-store.ts)
 */

import { BasePortalAdapter, type NormalizedReview } from "./base-adapter"
import type { PortalSecret, ApiKeySecret } from "@/lib/aws/secrets-manager"

// ─────────────────────────────────────────────────────────────────────────────
// Huawei AppGallery
// Docs: https://developer.huawei.com/consumer/en/doc/AppGallery-connect-References/agcapi-api-list-0000001094643734
// Auth: API Key (client_id + client_secret → access_token)
// ─────────────────────────────────────────────────────────────────────────────
export class HuaweiAppGalleryAdapter extends BasePortalAdapter {
  readonly platform    = "HUAWEI_APPGALLERY"
  readonly displayName = "Huawei AppGallery"
  readonly authModes   = ["API_KEY"] as const

  /** Obtain a short-lived access token from Huawei AGConnect */
  private async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const res = await fetch(
      "https://connect-api.cloud.huawei.com/api/oauth2/v1/token",
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id:     clientId,
          client_secret: clientSecret,
          grant_type:    "client_credentials",
        }),
      },
    )
    const data = await res.json()
    return data.access_token as string
  }

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    // apiKey = "clientId:clientSecret"
    const [clientId, clientSecret] = apiKey.split(":")
    if (!clientId || !clientSecret) return false
    try {
      const token = await this.getAccessToken(clientId, clientSecret)
      return !!token
    } catch {
      return false
    }
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey }           = secret as ApiKeySecret
    const [clientId, clientSecret] = apiKey.split(":")
    const appId                 = config.productId  // Huawei App ID
    const packageName           = config.packageName ?? appId

    const token  = await this.getAccessToken(clientId, clientSecret)

    const params = new URLSearchParams({
      appId,
      lang:     config.lang ?? "en",
      pageNum:  "1",
      pageSize: "50",
      orderBy:  "time",
    })

    const res  = await fetch(
      `https://connect-api.cloud.huawei.com/api/publish/v2/user-comment/query-dev-reply?${params}`,
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          client_id:      clientId,
          "Content-Type": "application/json",
        },
      },
    )
    const data = await res.json()

    return (data.ret?.commentData ?? []).map((r: Record<string, unknown>) => ({
      externalId:   r.id as string,
      platform:     this.platform,
      authorName:   r.nickname as string ?? "Huawei User",
      rating:       Math.round((r.rating as number ?? 5) / 2),  // Huawei uses 1-10 → 1-5
      body:         r.content as string ?? "",
      reviewedAt:   new Date((r.time as number) * 1000),
      productId:    appId,
      productName:  config.productName ?? packageName,
      isVerified:   true,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { apiKey }              = secret as ApiKeySecret
    const [clientId, clientSecret] = apiKey.split(":")
    const token                    = await this.getAccessToken(clientId, clientSecret)

    await fetch(
      "https://connect-api.cloud.huawei.com/api/publish/v2/user-comment/reply",
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          client_id:      clientId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyList: [{ commentId: reviewId, replyContent: response }],
        }),
      },
    )
  }
}
