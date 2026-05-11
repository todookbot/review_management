/**
 * Internal / Custom Adapters
 * QR Feedback · Custom API · Email Survey · In-App SDK
 *
 * These are platform-agnostic sources where the tenant owns the data collection.
 */

import { BasePortalAdapter, type NormalizedReview } from "./base-adapter"
import type { PortalSecret, ApiKeySecret } from "@/lib/aws/secrets-manager"
import crypto from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// QR Feedback
// No external API — reviews submitted directly to ReviewPulse via a
// hosted feedback form at: /feedback/[tenantId]/[sourceId]
// ─────────────────────────────────────────────────────────────────────────────
export class QrFeedbackAdapter extends BasePortalAdapter {
  readonly platform    = "QR_FEEDBACK"
  readonly displayName = "QR Feedback Form"
  readonly authModes   = ["NONE"] as const  // Built-in — no auth needed

  async validateApiKey(): Promise<boolean> { return true }

  /**
   * QR feedback reviews are submitted via webhook (our own form POST).
   * fetchReviews is not used — reviews arrive via the webhook endpoint.
   */
  async fetchReviews(): Promise<NormalizedReview[]> { return [] }

  async publishResponse(): Promise<void> {
    // QR form is one-way — no reply mechanism
    console.log("QR Feedback: no reply mechanism — consider sending follow-up email via SES")
  }

  /**
   * Normalize a QR form submission into a NormalizedReview.
   * Called by the webhook handler when the hosted form is submitted.
   */
  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedReview | null {
    if (!payload.body && !payload.rating) return null
    return {
      externalId:   payload.submissionId as string ?? crypto.randomUUID(),
      platform:     this.platform,
      authorName:   payload.name     as string ?? "Anonymous Customer",
      rating:       payload.rating   as number ?? 3,
      body:         payload.feedback as string ?? payload.body as string ?? "",
      reviewedAt:   new Date(payload.submittedAt as string ?? Date.now()),
      locationId:   payload.locationId   as string,
      locationName: payload.locationName as string,
      isVerified:   false,
      metadata:     payload,
    }
  }

  /**
   * Generate a public QR code URL for a source.
   * The hosted form lives at /feedback/[tenantId]/[sourceId]
   */
  static getFeedbackUrl(tenantId: string, sourceId: string): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}/feedback/${tenantId}/${sourceId}`
  }

  /**
   * Generate a QR code data URL using Google Charts API.
   */
  static getQrCodeUrl(tenantId: string, sourceId: string): string {
    const feedbackUrl = QrFeedbackAdapter.getFeedbackUrl(tenantId, sourceId)
    return `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(feedbackUrl)}&choe=UTF-8`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom REST API
// Tenant provides their own JSON review endpoint.
// Config: endpoint URL, optional auth header, JSON path mapping
// ─────────────────────────────────────────────────────────────────────────────
export class CustomApiAdapter extends BasePortalAdapter {
  readonly platform    = "CUSTOM_API"
  readonly displayName = "Custom API"
  readonly authModes   = ["API_KEY", "OAUTH", "WEBHOOK"] as const

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    if (!config?.endpointUrl) return false
    try {
      const res = await fetch(config.endpointUrl, {
        headers: {
          [config.authHeader ?? "Authorization"]: apiKey,
          Accept: "application/json",
        },
      })
      return res.ok
    } catch {
      return false
    }
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const apiKey       = (secret as ApiKeySecret).apiKey ?? ""
    const endpointUrl  = config.endpointUrl
    const authHeader   = config.authHeader  ?? "Authorization"
    const authScheme   = config.authScheme  ?? "Bearer"

    // Optional query params from config
    const params       = new URLSearchParams()
    if (since && config.sinceParam) params.set(config.sinceParam, since.toISOString())
    if (config.limitParam)          params.set(config.limitParam, "50")

    const url = `${endpointUrl}${params.toString() ? `?${params}` : ""}`
    const res = await fetch(url, {
      headers: {
        [authHeader]: `${authScheme} ${apiKey}`.trim(),
        Accept:       "application/json",
      },
    })
    const raw = await res.json()

    // Extract review array using JSONPath-lite: config.dataPath e.g. "data.reviews"
    const reviews = config.dataPath
      ? config.dataPath.split(".").reduce<unknown>((obj, key) => (obj as Record<string, unknown>)?.[key], raw)
      : raw

    const reviewArray = Array.isArray(reviews) ? reviews : []

    // Field mapping from config: config.fieldMap = JSON string
    const fieldMap: Record<string, string> = config.fieldMap
      ? JSON.parse(config.fieldMap)
      : {
          id:          "id",
          author:      "author",
          rating:      "rating",
          body:        "body",
          reviewedAt:  "created_at",
        }

    return reviewArray.map((r: Record<string, unknown>) => ({
      externalId:   String(r[fieldMap.id]   ?? crypto.randomUUID()),
      platform:     this.platform,
      authorName:   r[fieldMap.author]      as string ?? "Customer",
      rating:       Number(r[fieldMap.rating]) || 3,
      body:         r[fieldMap.body]        as string ?? "",
      reviewedAt:   new Date(r[fieldMap.reviewedAt] as string ?? Date.now()),
      locationId:   r[fieldMap.locationId ?? "location_id"] as string,
      locationName: r[fieldMap.locationName ?? "location"]  as string ?? config.locationName,
      isVerified:   Boolean(r[fieldMap.verified ?? "verified"]),
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    // Custom response endpoint — config driven
    console.log(`Custom API: response to ${reviewId} — implement responseEndpoint config`)
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedReview | null {
    // Generic webhook normalization — tries common field names
    const body = payload.review ?? payload.body ?? payload.text ?? payload.comment
    if (!body) return null

    return {
      externalId:   payload.id as string ?? payload.review_id as string ?? crypto.randomUUID(),
      platform:     this.platform,
      authorName:   payload.author as string ?? payload.name as string ?? payload.user as string ?? "Customer",
      rating:       Number(payload.rating ?? payload.stars ?? payload.score ?? 3),
      body:         body as string,
      reviewedAt:   new Date(payload.created_at as string ?? payload.date as string ?? Date.now()),
      locationId:   payload.location_id as string,
      locationName: payload.location    as string,
      productId:    payload.product_id  as string,
      productName:  payload.product     as string,
      isVerified:   Boolean(payload.verified),
      metadata:     payload,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Survey (NPS / CSAT via Amazon SES)
// Reviews collected via SES-sent survey emails.
// Responses submitted via a hosted survey form at /survey/[tenantId]/[surveyId]
// ─────────────────────────────────────────────────────────────────────────────
export class EmailSurveyAdapter extends BasePortalAdapter {
  readonly platform    = "EMAIL_SURVEY"
  readonly displayName = "Email Survey (NPS/CSAT)"
  readonly authModes   = ["NONE"] as const

  async validateApiKey(): Promise<boolean> { return true }

  async fetchReviews(): Promise<NormalizedReview[]> { return [] }

  async publishResponse(): Promise<void> {
    // Survey responses trigger automated follow-up emails via SES
    console.log("Email Survey: follow-up handled via SES automation")
  }

  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedReview | null {
    const score    = Number(payload.npsScore ?? payload.csatScore ?? payload.rating)
    const feedback = payload.feedback as string ?? payload.comment as string ?? ""
    if (!score && !feedback) return null

    // NPS: 0-10 → 1-5 stars (promoter=5, passive=3, detractor=1)
    const isNps  = payload.npsScore !== undefined
    const rating = isNps
      ? score >= 9 ? 5 : score >= 7 ? 3 : 1
      : Math.min(5, Math.max(1, Math.round(score)))

    return {
      externalId:   payload.responseId as string ?? crypto.randomUUID(),
      platform:     this.platform,
      authorName:   payload.name  as string ?? payload.email as string ?? "Survey Respondent",
      authorId:     payload.email as string,
      rating,
      body:         feedback || (isNps
        ? `NPS Score: ${score}/10 — ${score >= 9 ? "Promoter" : score >= 7 ? "Passive" : "Detractor"}`
        : `CSAT Score: ${score}/5`),
      reviewedAt:   new Date(payload.submittedAt as string ?? Date.now()),
      locationId:   payload.locationId   as string,
      locationName: payload.locationName as string,
      isVerified:   true,
      metadata:     payload,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-App SDK
// Reviews submitted from within the tenant's own mobile/web app via our SDK.
// SDK sends a POST to /api/webhooks/[tenantId]/[sourceId] directly.
// ─────────────────────────────────────────────────────────────────────────────
export class InAppSdkAdapter extends BasePortalAdapter {
  readonly platform    = "INAPP_SDK"
  readonly displayName = "In-App SDK"
  readonly authModes   = ["WEBHOOK"] as const

  async validateApiKey(): Promise<boolean> { return true }
  async fetchReviews():   Promise<NormalizedReview[]> { return [] }
  async publishResponse(): Promise<void> {
    console.log("In-App SDK: respond via push notification or in-app message")
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex")
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedReview | null {
    if (!payload.rating) return null
    return {
      externalId:   payload.id         as string ?? crypto.randomUUID(),
      platform:     this.platform,
      authorName:   payload.userName   as string ?? payload.userId as string ?? "App User",
      authorId:     payload.userId     as string,
      authorAvatar: payload.userAvatar as string,
      rating:       Number(payload.rating),
      body:         payload.feedback   as string ?? payload.review as string ?? "",
      reviewedAt:   new Date(payload.createdAt as string ?? Date.now()),
      locationId:   payload.locationId as string,
      productId:    payload.productId  as string,
      isVerified:   Boolean(payload.isVerifiedUser),
      metadata:     payload,
    }
  }
}
