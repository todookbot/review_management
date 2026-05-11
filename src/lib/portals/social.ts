/**
 * Social Media Adapters
 * Facebook · Twitter/X · Instagram · Reddit · LinkedIn
 */

import { BasePortalAdapter, type NormalizedReview, type OAuthConfig } from "./base-adapter"
import type { PortalSecret, ApiKeySecret, OAuthSecret } from "@/lib/aws/secrets-manager"
import crypto from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Pages
// Docs: https://developers.facebook.com/docs/graph-api/reference/page/ratings
// Auth: OAuth 2.0 (Facebook Login — page access token)
// ─────────────────────────────────────────────────────────────────────────────
export class FacebookAdapter extends BasePortalAdapter {
  readonly platform    = "FACEBOOK"
  readonly displayName = "Facebook"
  readonly authModes   = ["OAUTH", "WEBHOOK"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.FACEBOOK_CLIENT_ID ?? "",
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/facebook`,
    scopes:       ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  }

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      redirect_uri:  this.oauthConfig.redirectUri,
      response_type: "code",
      scope:         this.oauthConfig.scopes.join(","),
      state,
    })
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      redirect_uri:  this.oauthConfig.redirectUri,
      code,
    })
    const res  = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`)
    const data = await res.json()

    // Get user info
    const meRes  = await fetch(`https://graph.facebook.com/me?access_token=${data.access_token}`)
    const me     = await meRes.json()

    return {
      accessToken:       data.access_token,
      refreshToken:      data.access_token, // FB long-lived tokens don't use refresh_token
      expiresAt:         new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
      tokenType:         "Bearer",
      scope:             this.oauthConfig.scopes.join(","),
      externalAccountId: me.email ?? me.id,
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    // Exchange short-lived for long-lived
    const params = new URLSearchParams({
      grant_type:        "fb_exchange_token",
      client_id:         this.oauthConfig.clientId,
      client_secret:     this.oauthConfig.clientSecret,
      fb_exchange_token: refreshToken,
    })
    const res  = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`)
    const data = await res.json()
    return {
      accessToken: data.access_token,
      expiresAt:   new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
    }
  }

  async validateApiKey(): Promise<boolean> { return false }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { accessToken } = secret as OAuthSecret
    const pageId           = config.locationId

    // Get page-level access token first
    const pageTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${accessToken}`,
    )
    const pageTokenData = await pageTokenRes.json()
    const pageToken      = pageTokenData.access_token ?? accessToken

    // Fetch ratings (recommendations)
    const fields  = "reviewer{name,picture},rating,review_text,created_time,recommendation_type"
    const ratingRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/ratings?fields=${fields}&limit=50&access_token=${pageToken}`,
    )
    const data = await ratingRes.json()

    return (data.data ?? []).map((r: Record<string, unknown>) => ({
      externalId:   r.id as string,
      platform:     this.platform,
      authorName:   (r.reviewer as Record<string, string>)?.name ?? "Facebook User",
      authorAvatar: (r.reviewer as Record<string, unknown>)?.picture
        ? ((r.reviewer as Record<string, Record<string, Record<string, string>>>).picture?.data?.url)
        : undefined,
      rating:       r.rating as number ?? (r.recommendation_type === "positive" ? 5 : 1),
      body:         r.review_text as string ?? "",
      reviewedAt:   new Date(r.created_time as string),
      locationId:   pageId,
      locationName: config.locationName,
      isVerified:   false,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { accessToken } = secret as OAuthSecret
    await fetch(
      `https://graph.facebook.com/v19.0/${reviewId}/comments`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: response, access_token: accessToken }),
      },
    )
  }

  // Webhook: Facebook sends hub.challenge for verification
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedReview | null {
    const entry   = (payload.entry as Record<string, unknown>[])?.[0]
    const changes = (entry?.changes as Record<string, unknown>[])?.[0]
    if (changes?.field !== "ratings") return null

    const r = changes.value as Record<string, unknown>
    return {
      externalId:  r.review_id as string,
      platform:    this.platform,
      authorName:  r.reviewer_name as string ?? "Facebook User",
      rating:      r.rating as number,
      body:        r.review_text as string ?? "",
      reviewedAt:  new Date(),
      isVerified:  false,
      metadata:    r,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Twitter / X
// Docs: https://developer.twitter.com/en/docs/twitter-api
// Auth: OAuth 2.0 (PKCE)
// Strategy: Pull @mentions + replies — surface as reviews with sentiment
// ─────────────────────────────────────────────────────────────────────────────
export class TwitterAdapter extends BasePortalAdapter {
  readonly platform    = "TWITTER"
  readonly displayName = "Twitter / X"
  readonly authModes   = ["OAUTH"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.TWITTER_CLIENT_ID ?? "",
    clientSecret: process.env.TWITTER_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/twitter`,
    scopes:       ["tweet.read", "users.read", "offline.access"],
  }

  buildOAuthUrl(state: string): string {
    const codeVerifier  = crypto.randomBytes(32).toString("base64url")
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url")

    const params = new URLSearchParams({
      response_type:         "code",
      client_id:             this.oauthConfig.clientId,
      redirect_uri:          this.oauthConfig.redirectUri,
      scope:                 this.oauthConfig.scopes.join(" "),
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: "S256",
    })
    return `https://twitter.com/i/oauth2/authorize?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${Buffer.from(`${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type:   "authorization_code",
        redirect_uri: this.oauthConfig.redirectUri,
        code_verifier:"challenge", // stored in session in real impl
      }),
    })
    const data = await res.json()
    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    new Date(Date.now() + (data.expires_in ?? 7200) * 1000),
      tokenType:    "Bearer",
      scope:        data.scope,
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${Buffer.from(`${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    })
    const data = await res.json()
    return {
      accessToken: data.access_token,
      expiresAt:   new Date(Date.now() + (data.expires_in ?? 7200) * 1000),
    }
  }

  async validateApiKey(): Promise<boolean> { return false }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { accessToken } = secret as OAuthSecret
    const handle           = config.twitterHandle ?? config.locationId // e.g. "@mybrand"
    const query            = `@${handle.replace("@", "")} -is:retweet lang:en`

    const params = new URLSearchParams({
      query,
      max_results:  "100",
      "tweet.fields": "created_at,author_id,public_metrics,lang",
      "user.fields":  "name,username,profile_image_url",
      "expansions":   "author_id",
      ...(since ? { start_time: since.toISOString() } : {}),
    })

    const res  = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()

    const usersById = Object.fromEntries(
      ((data.includes?.users ?? []) as Record<string, string>[]).map(u => [u.id, u])
    )

    return (data.data ?? []).map((t: Record<string, unknown>) => {
      const author     = usersById[t.author_id as string] ?? {}
      const metrics    = t.public_metrics as Record<string, number> ?? {}
      const likeRatio  = (metrics.like_count ?? 0) / Math.max(metrics.impression_count ?? 1, 1)
      const rating     = likeRatio > 0.05 ? 4 : likeRatio > 0.01 ? 3 : 2 // heuristic rating

      return {
        externalId:   t.id as string,
        platform:     this.platform,
        authorName:   (author as Record<string, string>).name ?? "Twitter User",
        authorAvatar: (author as Record<string, string>).profile_image_url,
        authorId:     t.author_id as string,
        rating,
        body:         t.text as string,
        reviewedAt:   new Date(t.created_at as string),
        locationName: config.locationName,
        isVerified:   false,
        metadata:     { tweet: t, metrics },
      }
    })
  }

  async publishResponse(tweetId: string, response: string, secret: PortalSecret): Promise<void> {
    const { accessToken } = secret as OAuthSecret
    await fetch("https://api.twitter.com/2/tweets", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text:           response,
        reply:          { in_reply_to_tweet_id: tweetId },
      }),
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Instagram Business
// Docs: https://developers.facebook.com/docs/instagram-api
// Auth: OAuth 2.0 via Facebook Graph API
// Strategy: Pull @mentions + comments on posts
// ─────────────────────────────────────────────────────────────────────────────
export class InstagramAdapter extends BasePortalAdapter {
  readonly platform    = "INSTAGRAM"
  readonly displayName = "Instagram"
  readonly authModes   = ["OAUTH"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.FACEBOOK_CLIENT_ID ?? "",
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/instagram`,
    scopes:       ["instagram_basic", "instagram_manage_comments", "pages_show_list"],
  }

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      redirect_uri:  this.oauthConfig.redirectUri,
      response_type: "code",
      scope:         this.oauthConfig.scopes.join(","),
      state,
    })
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      redirect_uri:  this.oauthConfig.redirectUri,
      code,
    })
    const res  = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`)
    const data = await res.json()
    return {
      accessToken:  data.access_token,
      refreshToken: data.access_token,
      expiresAt:    new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
      tokenType:    "Bearer",
      scope:        this.oauthConfig.scopes.join(","),
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    const res  = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.oauthConfig.clientId}&client_secret=${this.oauthConfig.clientSecret}&fb_exchange_token=${refreshToken}`
    )
    const data = await res.json()
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + 5184000 * 1000) }
  }

  async validateApiKey(): Promise<boolean> { return false }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { accessToken } = secret as OAuthSecret
    const igAccountId      = config.locationId

    // Fetch @mentions
    const mentionsRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/tags?fields=id,text,timestamp,from,media_type&access_token=${accessToken}`,
    )
    const mentionsData = await mentionsRes.json()

    return (mentionsData.data ?? []).map((m: Record<string, unknown>) => ({
      externalId:   m.id as string,
      platform:     this.platform,
      authorName:   (m.from as Record<string, string>)?.username ?? "Instagram User",
      rating:       3, // Instagram has no star rating — default neutral, NLP will tag sentiment
      body:         m.text as string ?? "",
      reviewedAt:   new Date(m.timestamp as string),
      locationName: config.locationName,
      isVerified:   false,
      metadata:     m,
    }))
  }

  async publishResponse(commentId: string, response: string, secret: PortalSecret): Promise<void> {
    const { accessToken } = secret as OAuthSecret
    await fetch(
      `https://graph.facebook.com/v19.0/${commentId}/replies`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: response, access_token: accessToken }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reddit
// Docs: https://www.reddit.com/dev/api
// Auth: OAuth 2.0 (application-only or user-specific)
// Strategy: Search brand mentions in subreddits
// ─────────────────────────────────────────────────────────────────────────────
export class RedditAdapter extends BasePortalAdapter {
  readonly platform    = "REDDIT"
  readonly displayName = "Reddit"
  readonly authModes   = ["OAUTH"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.REDDIT_CLIENT_ID ?? "",
    clientSecret: process.env.REDDIT_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/reddit`,
    scopes:       ["read", "submit"],
  }

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      response_type: "code",
      state,
      redirect_uri:  this.oauthConfig.redirectUri,
      duration:      "permanent",
      scope:         this.oauthConfig.scopes.join(" "),
    })
    return `https://www.reddit.com/api/v1/authorize?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${Buffer.from(`${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`).toString("base64")}`,
        "User-Agent":   "ReviewPulse/1.0",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.oauthConfig.redirectUri }),
    })
    const data = await res.json()
    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType:    "bearer",
      scope:        data.scope,
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${Buffer.from(`${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`).toString("base64")}`,
        "User-Agent":   "ReviewPulse/1.0",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    })
    const data = await res.json()
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) }
  }

  async validateApiKey(): Promise<boolean> { return false }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { accessToken } = secret as OAuthSecret
    const brandKeyword     = config.brandKeyword ?? config.locationName ?? ""
    const subreddits       = config.subreddits ?? "all"

    const params = new URLSearchParams({
      q:       brandKeyword,
      sr_name: subreddits,
      sort:    "new",
      limit:   "50",
      type:    "link,comment",
    })

    const res  = await fetch(`https://oauth.reddit.com/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "ReviewPulse/1.0" },
    })
    const data = await res.json()

    return ((data.data?.children ?? []) as Record<string, unknown>[]).map((child) => {
      const d = child.data as Record<string, unknown>
      return {
        externalId:   d.id as string,
        platform:     this.platform,
        authorName:   d.author as string,
        rating:       (d.score as number ?? 0) > 10 ? 4 : (d.score as number ?? 0) > 0 ? 3 : 2,
        title:        d.title as string,
        body:         (d.selftext as string || d.body as string) ?? "",
        reviewedAt:   new Date((d.created_utc as number) * 1000),
        locationName: config.locationName,
        isVerified:   false,
        metadata:     { ...d, permalink: `https://reddit.com${d.permalink}` },
      }
    })
  }

  async publishResponse(postId: string, response: string, secret: PortalSecret): Promise<void> {
    const { accessToken } = secret as OAuthSecret
    await fetch("https://oauth.reddit.com/api/comment", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":   "ReviewPulse/1.0",
      },
      body: new URLSearchParams({ api_type: "json", thing_id: `t3_${postId}`, text: response }),
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
// Auth: OAuth 2.0
// Strategy: Pull company page reviews / recommendations
// ─────────────────────────────────────────────────────────────────────────────
export class LinkedInAdapter extends BasePortalAdapter {
  readonly platform    = "LINKEDIN"
  readonly displayName = "LinkedIn"
  readonly authModes   = ["OAUTH"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/linkedin`,
    scopes:       ["r_organization_social", "w_organization_social", "r_basicprofile"],
  }

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id:     this.oauthConfig.clientId,
      redirect_uri:  this.oauthConfig.redirectUri,
      scope:         this.oauthConfig.scopes.join(" "),
      state,
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri:  this.oauthConfig.redirectUri,
      }),
    })
    const data = await res.json()

    const meRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    const me = await meRes.json()

    return {
      accessToken:       data.access_token,
      refreshToken:      data.refresh_token ?? data.access_token,
      expiresAt:         new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
      tokenType:         "Bearer",
      scope:             data.scope,
      externalAccountId: me.id,
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
      }),
    })
    const data = await res.json()
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) }
  }

  async validateApiKey(): Promise<boolean> { return false }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { accessToken } = secret as OAuthSecret
    const orgId            = config.locationId // LinkedIn organization URN e.g. "urn:li:organization:12345"

    // LinkedIn Company Reviews (via Social API)
    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(orgId)}/comments?count=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const data = await res.json()

    return (data.elements ?? []).map((c: Record<string, unknown>) => {
      const actor = c.actor as Record<string, unknown>
      return {
        externalId:   c.id as string,
        platform:     this.platform,
        authorName:   ((actor?.name as Record<string, Record<string, string>>)?.localized as Record<string, string>)?.en_US ?? "LinkedIn Member",
        authorId:     actor?.id as string,
        rating:       3, // LinkedIn has no star rating — NLP handles sentiment
        body:         (c.message as Record<string, string>)?.text ?? "",
        reviewedAt:   new Date(((c.created as Record<string, number>)?.time) ?? Date.now()),
        locationName: config.locationName,
        isVerified:   false,
        metadata:     c,
      }
    })
  }

  async publishResponse(commentId: string, response: string, secret: PortalSecret): Promise<void> {
    const { accessToken } = secret as OAuthSecret
    await fetch(
      `https://api.linkedin.com/v2/socialActions/${commentId}/comments`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { text: response } }),
      },
    )
  }
}
