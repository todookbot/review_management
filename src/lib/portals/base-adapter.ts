import type { PortalSecret } from "@/lib/aws/secrets-manager"

export interface NormalizedReview {
  externalId:   string
  platform:     string
  authorName:   string
  authorAvatar?: string
  authorId?:    string
  rating:       number        // 1–5
  title?:       string
  body:         string
  reviewedAt:   Date
  locationId?:  string
  locationName?: string
  productId?:   string
  productName?: string
  isVerified:   boolean
  metadata:     Record<string, unknown>
}

export interface OAuthConfig {
  clientId:     string
  clientSecret: string
  redirectUri:  string
  scopes:       string[]
}

export abstract class BasePortalAdapter {
  abstract readonly platform: string
  abstract readonly displayName: string
  abstract readonly authModes: ReadonlyArray<"API_KEY" | "OAUTH" | "WEBHOOK" | "NONE">
  readonly oauthConfig?: OAuthConfig

  /** Validate that a provided API key actually works */
  abstract validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean>

  /** Build the OAuth authorization URL */
  buildOAuthUrl?(state: string, origin?: string): string

  /** Exchange OAuth code for tokens */
  exchangeOAuthCode?(code: string, origin?: string): Promise<{
    accessToken:  string
    refreshToken: string
    expiresAt:    Date
    tokenType:    string
    scope:        string
    externalAccountId?: string
  }>

  /** Refresh an expired OAuth token */
  refreshOAuthToken?(refreshToken: string): Promise<{
    accessToken: string
    expiresAt:   Date
  }>

  /** Fetch reviews from the platform */
  abstract fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]>

  /** Publish a response back to the platform */
  abstract publishResponse(
    reviewId:   string,
    response:   string,
    secret:     PortalSecret,
  ): Promise<void>

  /** Verify webhook payload signature */
  verifyWebhookSignature?(
    payload: string,
    signature: string,
    secret:    string,
  ): boolean

  /** Normalize a raw webhook event into a NormalizedReview */
  normalizeWebhookEvent?(payload: Record<string, unknown>): NormalizedReview | null
}
