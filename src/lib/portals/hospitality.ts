/**
 * Hospitality Adapters
 * Booking.com · Airbnb · Expedia · Agoda
 */

import { BasePortalAdapter, type NormalizedReview, type OAuthConfig } from "./base-adapter"
import type { PortalSecret, ApiKeySecret, OAuthSecret } from "@/lib/aws/secrets-manager"

// ─────────────────────────────────────────────────────────────────────────────
// Booking.com
// Docs: https://developers.booking.com/api/
// Auth: API Key (username:password HTTP Basic via Connectivity API)
// ─────────────────────────────────────────────────────────────────────────────
export class BookingComAdapter extends BasePortalAdapter {
  readonly platform    = "BOOKING_COM"
  readonly displayName = "Booking.com"
  readonly authModes   = ["API_KEY"] as const

  private authHeader(apiKey: string): string {
    // apiKey stored as "username:password" joined
    return `Basic ${Buffer.from(apiKey).toString("base64")}`
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch(
      "https://supply-xml.booking.com/hotels/ota/OTA_HotelSearch",
      {
        method:  "POST",
        headers: {
          Authorization:  this.authHeader(apiKey),
          "Content-Type": "application/xml",
        },
        body: `<?xml version="1.0" encoding="UTF-8"?><OTA_HotelSearchRQ Version="2.0"/>`,
      },
    )
    return res.status !== 401
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey }  = secret as ApiKeySecret
    const hotelId      = config.locationId

    // Booking.com Demand API — guest reviews endpoint
    const params = new URLSearchParams({
      hotel_ids:  hotelId,
      page_size:  "50",
      sort_by:    "date",
      sort_order: "descending",
      ...(since ? { date_from: since.toISOString().split("T")[0] } : {}),
    })

    const res = await fetch(
      `https://demandapi.booking.com/3.1/reviews/hotel?${params}`,
      { headers: { Authorization: this.authHeader(apiKey) } },
    )
    const data = await res.json()

    return (data.result ?? []).map((r: Record<string, unknown>) => {
      const pos = r.pros as string ?? ""
      const neg = r.cons as string ?? ""
      const body = [pos && `✅ ${pos}`, neg && `❌ ${neg}`].filter(Boolean).join("\n")

      return {
        externalId:   r.review_id as string,
        platform:     this.platform,
        authorName:   r.reviewer_name as string ?? "Booking.com Guest",
        rating:       Math.round((r.average_score as number) / 2), // 0-10 → 1-5
        title:        r.headline as string,
        body:         body || (r.review_text as string ?? ""),
        reviewedAt:   new Date(r.date as string),
        locationId:   hotelId,
        locationName: config.locationName,
        isVerified:   true, // All Booking.com reviews are verified stays
        metadata:     r,
      }
    })
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { apiKey } = secret as ApiKeySecret
    await fetch(
      `https://demandapi.booking.com/3.1/reviews/${reviewId}/response`,
      {
        method:  "POST",
        headers: {
          Authorization:  this.authHeader(apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response_text: response }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Airbnb
// Docs: https://www.airbnb.com/partner/api (Partner API — requires approval)
// Auth: OAuth 2.0
// ─────────────────────────────────────────────────────────────────────────────
export class AirbnbAdapter extends BasePortalAdapter {
  readonly platform    = "AIRBNB"
  readonly displayName = "Airbnb"
  readonly authModes   = ["OAUTH"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.AIRBNB_CLIENT_ID ?? "",
    clientSecret: process.env.AIRBNB_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/airbnb`,
    scopes:       ["listings:read", "reviews:read", "reviews:write"],
  }

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      redirect_uri:  this.oauthConfig.redirectUri,
      response_type: "code",
      scope:         this.oauthConfig.scopes.join(" "),
      state,
    })
    return `https://www.airbnb.com/oauth2/auth?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const res = await fetch("https://api.airbnb.com/v2/oauth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        grant_type:    "authorization_code",
        redirect_uri:  this.oauthConfig.redirectUri,
      }),
    })
    const data = await res.json()
    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType:    data.token_type ?? "Bearer",
      scope:        this.oauthConfig.scopes.join(" "),
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    const res = await fetch("https://api.airbnb.com/v2/oauth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        grant_type:    "refresh_token",
      }),
    })
    const data = await res.json()
    return {
      accessToken: data.access_token,
      expiresAt:   new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    }
  }

  async validateApiKey(): Promise<boolean> { return false }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { accessToken } = secret as OAuthSecret
    const listingId        = config.locationId

    const params = new URLSearchParams({
      listing_id: listingId,
      _limit:     "50",
      _format:    "for_mobile_client",
    })

    const res = await fetch(
      `https://api.airbnb.com/v2/reviews?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const data = await res.json()

    return (data.reviews ?? []).map((r: Record<string, unknown>) => ({
      externalId:   String(r.id),
      platform:     this.platform,
      authorName:   (r.reviewer as Record<string, string>)?.first_name ?? "Airbnb Guest",
      authorAvatar: (r.reviewer as Record<string, string>)?.picture_url,
      rating:       r.rating as number ?? 5,
      body:         r.comments as string ?? "",
      reviewedAt:   new Date(r.created_at as string),
      locationId:   listingId,
      locationName: config.locationName,
      isVerified:   true,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { accessToken } = secret as OAuthSecret
    await fetch(
      `https://api.airbnb.com/v2/reviews/${reviewId}/responses`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expedia
// Docs: https://developers.expediagroup.com/supply/lodging
// Auth: API Key (Client ID + API Key)
// ─────────────────────────────────────────────────────────────────────────────
export class ExpediaAdapter extends BasePortalAdapter {
  readonly platform    = "EXPEDIA"
  readonly displayName = "Expedia"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    return !!(apiKey && config?.clientId)
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey }  = secret as ApiKeySecret
    const clientId     = config.clientId
    const propertyId   = config.locationId

    // Expedia Partner Central API — review endpoint
    const res = await fetch(
      `https://api.expediagroup.com/supply/lodging/reviews/v1/properties/${propertyId}/reviews?limit=50`,
      {
        headers: {
          "Client-Id":        clientId,
          "Client-Api-Key":   apiKey,
          "Content-Type":     "application/json",
        },
      },
    )
    const data = await res.json()

    return (data.reviews ?? []).map((r: Record<string, unknown>) => {
      const ratings = r.ratings as Record<string, number> ?? {}
      const overallRating = ratings.overall ?? r.overall_rating as number ?? 0

      return {
        externalId:   r.review_id as string,
        platform:     this.platform,
        authorName:   r.reviewer_name as string ?? "Expedia Traveler",
        rating:       Math.round(overallRating / 2), // 0-10 → 1-5
        title:        r.review_title as string,
        body:         r.review_body as string ?? "",
        reviewedAt:   new Date(r.submission_time as string),
        locationId:   propertyId,
        locationName: config.locationName,
        isVerified:   true,
        metadata:     r,
      }
    })
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { apiKey }  = secret as ApiKeySecret
    const config = { clientId: "" } // pulled from secret config in real impl
    await fetch(
      `https://api.expediagroup.com/supply/lodging/reviews/v1/reviews/${reviewId}/responses`,
      {
        method:  "POST",
        headers: {
          "Client-Api-Key":   apiKey,
          "Content-Type":     "application/json",
        },
        body: JSON.stringify({ response_body: response }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agoda
// Docs: https://ycs.agoda.com/en-us/partner-central/content-api/
// Auth: API Key (hotel_id + api_key)
// ─────────────────────────────────────────────────────────────────────────────
export class AgodaAdapter extends BasePortalAdapter {
  readonly platform    = "AGODA"
  readonly displayName = "Agoda"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    return !!(apiKey && config?.hotelId)
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const hotelId     = config.locationId ?? config.hotelId

    const body = {
      criteria: {
        hotelId:       parseInt(hotelId),
        pageNumber:    1,
        pageSize:      50,
        sortBy:        "SubmittedDate",
        sortDirection: "Desc",
        ...(since ? { fromDate: since.toISOString().split("T")[0] } : {}),
      },
    }

    const res = await fetch(
      "https://affiliateapi7643.agoda.com/affiliateservice/lt_v1",
      {
        method:  "POST",
        headers: {
          "Authorization": `apikey ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    const data = await res.json()

    return (data.resultList ?? []).map((r: Record<string, unknown>) => ({
      externalId:   String(r.reviewId),
      platform:     this.platform,
      authorName:   r.reviewerDisplayName as string ?? "Agoda Guest",
      rating:       Math.round((r.overallScore as number ?? 0) / 2), // 0-10 → 1-5
      title:        r.headline as string,
      body:         [r.positiveReview, r.negativeReview].filter(Boolean).join("\n\n") as string,
      reviewedAt:   new Date(r.checkoutDate as string ?? r.submittedDate as string),
      locationId:   hotelId,
      locationName: config.locationName,
      isVerified:   true,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { apiKey } = secret as ApiKeySecret
    await fetch(
      "https://affiliateapi7643.agoda.com/affiliateservice/review_response",
      {
        method:  "POST",
        headers: {
          Authorization:  `apikey ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reviewId, responseText: response }),
      },
    )
  }
}
