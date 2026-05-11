/**
 * Location / Physical Store Adapters
 * TripAdvisor · Foursquare · Apple Maps · Zomato · JustDial
 */

import { BasePortalAdapter, type NormalizedReview, type OAuthConfig } from "./base-adapter"
import type { PortalSecret, ApiKeySecret, OAuthSecret } from "@/lib/aws/secrets-manager"
import crypto from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// TripAdvisor
// Docs: https://tripadvisor-content-api.readme.io/reference/overview
// Auth: API Key (passed as key query param)
// ─────────────────────────────────────────────────────────────────────────────
export class TripAdvisorAdapter extends BasePortalAdapter {
  readonly platform    = "TRIPADVISOR"
  readonly displayName = "TripAdvisor"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch(
      `https://api.content.tripadvisor.com/api/v1/location/search?searchQuery=test&key=${apiKey}&language=en`,
    )
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const locationId  = config.locationId  // TripAdvisor location ID

    const res = await fetch(
      `https://api.content.tripadvisor.com/api/v1/location/${locationId}/reviews?key=${apiKey}&language=en`,
    )
    const data = await res.json()

    return (data.data ?? []).map((r: Record<string, unknown>) => ({
      externalId:   r.id as string,
      platform:     this.platform,
      authorName:   (r.user as Record<string, string>)?.username ?? "TripAdvisor User",
      authorAvatar: (r.user as Record<string, string>)?.avatar?.small,
      rating:       r.rating as number,
      title:        r.title as string,
      body:         r.text as string,
      reviewedAt:   new Date(r.published_date as string),
      locationId:   locationId,
      locationName: config.locationName,
      isVerified:   true,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    // TripAdvisor Management API — owner responses
    const { apiKey } = secret as ApiKeySecret
    await fetch(
      `https://api.content.tripadvisor.com/api/v1/reviews/${reviewId}/management_response`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ response_text: response, key: apiKey }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Foursquare
// Docs: https://docs.foursquare.com/developer/reference/place-tips
// Auth: API Key (OAuth token)
// ─────────────────────────────────────────────────────────────────────────────
export class FoursquareAdapter extends BasePortalAdapter {
  readonly platform    = "FOURSQUARE"
  readonly displayName = "Foursquare"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch("https://api.foursquare.com/v3/places/search?query=test&near=NYC&limit=1", {
      headers: { Authorization: apiKey },
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const fsqId       = config.locationId  // Foursquare venue/place ID

    const res = await fetch(
      `https://api.foursquare.com/v3/places/${fsqId}/tips?limit=50&sort=NEWEST`,
      { headers: { Authorization: apiKey } },
    )
    const data = await res.json()

    return (data.items ?? data ?? []).map((r: Record<string, unknown>) => ({
      externalId:   r.id as string,
      platform:     this.platform,
      authorName:   (r.user as Record<string, string>)?.name ?? "Foursquare User",
      authorAvatar: (r.user as Record<string, string>)?.photo
        ? `${(r.user as Record<string, string>).photo}36x36.jpg`
        : undefined,
      rating:       (r.agreeCount as number ?? 0) > 5 ? 5 : 4, // Foursquare tips = likes-based
      body:         r.text as string,
      reviewedAt:   new Date((r.createdAt as number) * 1000),
      locationId:   fsqId,
      locationName: config.locationName,
      isVerified:   false,
      metadata:     r,
    }))
  }

  async publishResponse(): Promise<void> {
    // Foursquare does not support owner responses via API
    console.log("Foursquare: owner responses not supported via API")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple Maps (Business Connect)
// Docs: https://developer.apple.com/documentation/apple_maps_server_api
// Auth: API Key (JWT signed with MapKit JS key)
// ─────────────────────────────────────────────────────────────────────────────
export class AppleMapsAdapter extends BasePortalAdapter {
  readonly platform    = "APPLE_MAPS"
  readonly displayName = "Apple Maps"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    return !!(apiKey && config?.teamId && config?.keyId)
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const placeId     = config.locationId

    // Apple Maps Business Connect ratings endpoint (limited public data)
    const res = await fetch(
      `https://places-api.apple.com/places/v1/${placeId}/ratings`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    const data = await res.json()

    // Apple provides aggregate ratings, not individual reviews via public API
    // We surface the aggregate as a synthetic review entry
    const avgRating = data.averageRating ?? 0
    if (!avgRating) return []

    return [{
      externalId:   `apple-${placeId}-aggregate`,
      platform:     this.platform,
      authorName:   "Aggregate Rating",
      rating:       Math.round(avgRating),
      body:         `${data.totalRatings ?? 0} ratings on Apple Maps. Average: ${avgRating.toFixed(1)}★`,
      reviewedAt:   new Date(),
      locationId:   placeId,
      locationName: config.locationName,
      isVerified:   true,
      metadata:     data,
    }]
  }

  async publishResponse(): Promise<void> {
    console.log("Apple Maps: owner responses not supported via API")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zomato
// Docs: https://developers.zomato.com/documentation
// Auth: API Key (user-key header)
// Note: Zomato public API v2.1
// ─────────────────────────────────────────────────────────────────────────────
export class ZomatoAdapter extends BasePortalAdapter {
  readonly platform    = "ZOMATO"
  readonly displayName = "Zomato"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch("https://developers.zomato.com/api/v2.1/cities?q=mumbai&count=1", {
      headers: { "user-key": apiKey, Accept: "application/json" },
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
  ): Promise<NormalizedReview[]> {
    const { apiKey }  = secret as ApiKeySecret
    const restaurantId = config.locationId

    const res = await fetch(
      `https://developers.zomato.com/api/v2.1/reviews?res_id=${restaurantId}&count=50`,
      { headers: { "user-key": apiKey, Accept: "application/json" } },
    )
    const data = await res.json()

    return (data.user_reviews ?? []).map((r: Record<string, unknown>) => {
      const review = r.review as Record<string, unknown>
      const user   = review.user as Record<string, unknown>
      return {
        externalId:   review.id as string,
        platform:     this.platform,
        authorName:   user?.name as string ?? "Zomato User",
        authorAvatar: user?.profile_image as string,
        rating:       Math.round((review.rating as number) / 2), // Zomato uses 0-10, normalize to 1-5
        body:         review.review_text as string ?? "",
        reviewedAt:   new Date((review.review_time_friendly as string) ?? Date.now()),
        locationId:   restaurantId,
        locationName: config.locationName,
        isVerified:   (review.votes as number ?? 0) > 0,
        metadata:     review,
      }
    })
  }

  async publishResponse(): Promise<void> {
    // Zomato Owner API (requires partner access)
    console.log("Zomato: owner responses require partner API access")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JustDial (India)
// Docs: https://www.justdial.com/api-documentation
// Auth: API Key + App Key
// ─────────────────────────────────────────────────────────────────────────────
export class JustDialAdapter extends BasePortalAdapter {
  readonly platform    = "JUSTDIAL"
  readonly displayName = "JustDial"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    return !!(apiKey && config?.appKey)
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
  ): Promise<NormalizedReview[]> {
    const { apiKey }  = secret as ApiKeySecret
    const appKey       = config.appKey
    const businessId   = config.locationId
    const city         = config.city ?? "Mumbai"

    const params = new URLSearchParams({
      api_key:     apiKey,
      app_key:     appKey,
      location:    city,
      term:        businessId,
      jsondata:    "1",
    })

    const res = await fetch(
      `https://api.justdial.com/v1/search?${params}`,
    )
    const data = await res.json()
    const biz   = (data.results ?? [])[0] as Record<string, unknown>
    if (!biz) return []

    // JustDial returns ratings at business level — map to review entries
    const reviews = (biz.ratingobj as Record<string, unknown>[]) ?? []
    return reviews.map((r, i) => ({
      externalId:   `jd-${businessId}-${i}`,
      platform:     this.platform,
      authorName:   r.reviewer as string ?? "JustDial User",
      rating:       parseFloat(r.rating as string ?? "3"),
      body:         r.reviewtext as string ?? "",
      reviewedAt:   new Date(r.time as string ?? Date.now()),
      locationId:   businessId,
      locationName: config.locationName ?? biz.company_name as string,
      isVerified:   true,
      metadata:     r,
    }))
  }

  async publishResponse(): Promise<void> {
    console.log("JustDial: owner responses require business dashboard login")
  }
}
