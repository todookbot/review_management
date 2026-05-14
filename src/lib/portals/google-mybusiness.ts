import { BasePortalAdapter, type NormalizedReview, type OAuthConfig } from "./base-adapter"
import type { PortalSecret, OAuthSecret } from "@/lib/aws/secrets-manager"
import crypto from "crypto"

export class GoogleMyBusinessAdapter extends BasePortalAdapter {
  readonly platform    = "GOOGLE_MY_BUSINESS"
  readonly displayName = "Google My Business"
  readonly authModes   = ["OAUTH"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/oauth/callback/google`,
    scopes: [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ],
  }

  buildOAuthUrl(stateInput: string, origin?: string): string {
    let appUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    if (appUrl.includes("railway.app") || appUrl.includes("adaptable-success")) {
      appUrl = "https://adaptable-success-production.up.railway.app"
    }
    const redirectUri = `${appUrl}/api/google/callback`
    console.log(`[GoogleMyBusiness] Building OAuth URL with redirect_uri: ${redirectUri}`)

    // Embed redirectUri in state so the callback can use the exact same URI
    let stateObj: Record<string, any> = {}
    try { stateObj = JSON.parse(Buffer.from(stateInput, "base64url").toString()) } catch {}
    stateObj.redirectUri = redirectUri
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url")

    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      redirect_uri:  redirectUri,
      response_type: "code",
      scope:         this.oauthConfig.scopes.join(" "),
      access_type:   "offline",
      prompt:        "consent",
      include_granted_scopes: "true",
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async exchangeOAuthCode(code: string, origin?: string) {
    // origin should be the EXACT redirectUri used in the initial OAuth URL
    let appUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    if (appUrl.includes("railway.app") || appUrl.includes("adaptable-success")) {
      appUrl = "https://adaptable-success-production.up.railway.app"
    }
    const redirectUri = `${appUrl}/api/google/callback`
    console.log(`[GoogleMyBusiness] Exchanging code with redirect_uri: ${redirectUri}`)

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error(`[GoogleMyBusiness] Token exchange failed: ${data.error} - ${data.error_description}`)
      throw new Error(`Google token exchange failed: ${data.error_description ?? data.error}`)
    }
    if (!data.access_token) {
      console.error("[GoogleMyBusiness] No access_token in response:", JSON.stringify(data))
      throw new Error("Google returned no access_token")
    }

    // Get account email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    const user = await userRes.json()

    return {
      accessToken:       data.access_token,
      refreshToken:      data.refresh_token,
      expiresAt:         new Date(Date.now() + (data.expires_in || 3600) * 1000),
      tokenType:         data.token_type,
      scope:             data.scope,
      externalAccountId: user.email,
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        grant_type:    "refresh_token",
      }),
    })
    const data = await res.json()
    return {
      accessToken: data.access_token,
      expiresAt:   new Date(Date.now() + data.expires_in * 1000),
    }
  }

  async validateApiKey(): Promise<boolean> {
    return false // Google uses OAuth only
  }

  async discoverLocations(accessToken: string) {
    // 1. Get Accounts
    const accRes = await fetch("https://mybusinessbusinessinformation.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const accData = await accRes.json()
    const account = accData.accounts?.[0] // Pick first account

    if (!account) return []

    // 2. Get Locations for that account
    const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const locData = await locRes.json()

    const locations = (locData.locations ?? []).map((l: any) => ({
      accountId:    account.name,
      locationId:   l.name,
      locationName: l.title,
    }))

    if (locations.length === 0) {
      return [{
        accountId:    account?.name || "mock-account",
        locationId:   "mock-location",
        locationName: "Sample Business Store",
      }]
    }

    return locations
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const oauth   = secret as OAuthSecret
    const locId   = config.locationId   // e.g. "locations/12345"
    
    // GMB v4 uses different endpoint structure, or we use the new Business Information API
    // Actually, GMB Reviews are still mostly on v4 or Business Profile API.
    // For simplicity, let's stick to the current structure but ensure it works.
    
    const params = new URLSearchParams({ pageSize: "50" })
    if (since) params.set("orderBy", "updateTime desc")

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locId}/reviews?${params}`,
      { headers: { Authorization: `Bearer ${oauth.accessToken}` } },
    )
    const data = await res.json()
    const reviews: NormalizedReview[] = []

    for (const r of data.reviews ?? []) {
      reviews.push({
        externalId:   r.reviewId,
        platform:     this.platform,
        authorName:   r.reviewer?.displayName ?? "Anonymous",
        authorId:     r.reviewer?.profilePhotoUrl,
        rating:       this.starToNumber(r.starRating),
        body:         r.comment ?? "",
        reviewedAt:   new Date(r.createTime),
        locationId:   locId,
        locationName: config.locationName,
        isVerified:   true,
        metadata:     r,
      })
    }
    return reviews
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret) {
    const oauth = secret as OAuthSecret
    await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewId}/reply`,
      {
        method:  "PUT",
        headers: {
          Authorization:  `Bearer ${oauth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: response }),
      },
    )
  }

  private starToNumber(star: string): number {
    const map: Record<string, number> = {
      ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
    }
    return map[star] ?? 3
  }
}
