/**
 * Product & E-commerce Review Adapters
 * Shopify · WooCommerce · Trustpilot · G2 · Capterra · Flipkart · ProductHunt
 */

import { BasePortalAdapter, type NormalizedReview, type OAuthConfig } from "./base-adapter"
import type { PortalSecret, ApiKeySecret, OAuthSecret } from "@/lib/aws/secrets-manager"

// ─────────────────────────────────────────────────────────────────────────────
// Shopify
// Docs: https://shopify.dev/docs/api/admin-rest/product-reviews
// Auth: OAuth 2.0 (Admin API)
// ─────────────────────────────────────────────────────────────────────────────
export class ShopifyAdapter extends BasePortalAdapter {
  readonly platform    = "SHOPIFY"
  readonly displayName = "Shopify"
  readonly authModes   = ["OAUTH", "API_KEY"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.SHOPIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/shopify`,
    scopes:       ["read_products", "read_product_reviews"],
  }

  buildOAuthUrl(state: string): string {
    const shop   = state // state encodes shop domain in Shopify OAuth
    const params = new URLSearchParams({
      client_id:    this.oauthConfig.clientId,
      scope:        this.oauthConfig.scopes.join(","),
      redirect_uri: this.oauthConfig.redirectUri,
      state,
    })
    return `https://${shop}.myshopify.com/admin/oauth/authorize?${params}`
  }

  async exchangeOAuthCode(code: string) {
    // In Shopify OAuth, shop domain comes from the state/request
    const shop = process.env.SHOPIFY_SHOP_DOMAIN ?? ""
    const res  = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        code,
      }),
    })
    const data = await res.json()
    return {
      accessToken:       data.access_token,
      refreshToken:      data.access_token,
      expiresAt:         new Date(Date.now() + 365 * 24 * 3600 * 1000), // Shopify tokens don't expire
      tokenType:         "Bearer",
      scope:             data.scope,
      externalAccountId: shop,
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    return { accessToken: refreshToken, expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000) }
  }

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    const shop = config?.shop
    if (!shop) return false
    const res = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": apiKey },
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const token     = (secret as OAuthSecret).accessToken ?? (secret as ApiKeySecret).apiKey
    const shop      = config.shop
    const productId = config.productId

    const params = new URLSearchParams({
      product_id: productId,
      status:     "published",
      limit:      "50",
      ...(since ? { created_at_min: since.toISOString() } : {}),
    })

    const res  = await fetch(
      `https://${shop}/admin/api/2024-01/products/${productId}/reviews.json?${params}`,
      { headers: { "X-Shopify-Access-Token": token } },
    )
    const data = await res.json()

    return (data.reviews ?? []).map((r: Record<string, unknown>) => ({
      externalId:   String(r.id),
      platform:     this.platform,
      authorName:   r.author as string ?? "Shopify Customer",
      rating:       r.rating as number,
      title:        r.title as string,
      body:         r.body as string ?? "",
      reviewedAt:   new Date(r.created_at as string),
      productId:    productId,
      productName:  config.productName,
      isVerified:   true,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    // Shopify Product Reviews app doesn't support API responses — manual only
    console.log(`Shopify: manual response needed for review ${reviewId}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WooCommerce
// Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
// Auth: API Key (Consumer Key + Consumer Secret via Basic Auth)
// ─────────────────────────────────────────────────────────────────────────────
export class WooCommerceAdapter extends BasePortalAdapter {
  readonly platform    = "WOOCOMMERCE"
  readonly displayName = "WooCommerce"
  readonly authModes   = ["API_KEY"] as const

  private authHeader(apiKey: string): string {
    // apiKey stored as "consumerKey:consumerSecret"
    return `Basic ${Buffer.from(apiKey).toString("base64")}`
  }

  async validateApiKey(apiKey: string, config?: Record<string, string>): Promise<boolean> {
    const siteUrl = config?.siteUrl
    if (!siteUrl) return false
    const res = await fetch(`${siteUrl}/wp-json/wc/v3/system_status`, {
      headers: { Authorization: this.authHeader(apiKey) },
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey }  = secret as ApiKeySecret
    const siteUrl      = config.siteUrl   // e.g. https://mystore.com
    const productId    = config.productId

    const params = new URLSearchParams({
      product:     productId,
      per_page:    "50",
      status:      "approved",
      ...(since ? { after: since.toISOString() } : {}),
    })

    const res  = await fetch(
      `${siteUrl}/wp-json/wc/v3/products/reviews?${params}`,
      { headers: { Authorization: this.authHeader(apiKey) } },
    )
    const data = await res.json() as Record<string, unknown>[]

    return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
      externalId:   String(r.id),
      platform:     this.platform,
      authorName:   r.reviewer as string ?? "WooCommerce Customer",
      authorAvatar: r.reviewer_avatar_urls
        ? (r.reviewer_avatar_urls as Record<string, string>)["96"]
        : undefined,
      rating:       r.rating as number,
      body:         (r.review as string ?? "").replace(/<[^>]*>/g, ""), // strip HTML
      reviewedAt:   new Date(r.date_created as string),
      productId,
      productName:  config.productName,
      isVerified:   r.verified as boolean ?? false,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { apiKey } = secret as ApiKeySecret
    const siteUrl    = "" // pulled from config in real impl
    await fetch(
      `${siteUrl}/wp-json/wc/v3/products/reviews/${reviewId}`,
      {
        method:  "PUT",
        headers: {
          Authorization:  this.authHeader(apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reviewer_reply: response }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trustpilot
// Docs: https://documentation-apidocumentation.trustpilot.com/
// Auth: API Key + OAuth (for business accounts)
// ─────────────────────────────────────────────────────────────────────────────
export class TrustpilotAdapter extends BasePortalAdapter {
  readonly platform    = "TRUSTPILOT"
  readonly displayName = "Trustpilot"
  readonly authModes   = ["API_KEY", "OAUTH"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.TRUSTPILOT_CLIENT_ID ?? "",
    clientSecret: process.env.TRUSTPILOT_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/trustpilot`,
    scopes:       ["basic", "manage"],
  }

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      redirect_uri:  this.oauthConfig.redirectUri,
      response_type: "code",
      scope:         this.oauthConfig.scopes.join(" "),
      state,
    })
    return `https://authenticate.trustpilot.com?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const res = await fetch("https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${Buffer.from(`${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: this.oauthConfig.redirectUri,
      }),
    })
    const data = await res.json()
    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType:    "Bearer",
      scope:        data.scope ?? "basic manage",
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    const res = await fetch("https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:  `Basic ${Buffer.from(`${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    })
    const data = await res.json()
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch(`https://api.trustpilot.com/v1/business-units/search?apikey=${apiKey}&query=test`)
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const apiKey       = (secret as ApiKeySecret).apiKey
      ?? (secret as OAuthSecret).accessToken
    const businessUnit = config.businessUnitId // Trustpilot business unit ID

    const params = new URLSearchParams({
      apikey:   apiKey ?? "",
      stars:    "",
      orderBy:  "createdat.desc",
      perPage:  "20",
      page:     "1",
      ...(since ? { startDateTime: since.toISOString() } : {}),
    })

    const res  = await fetch(
      `https://api.trustpilot.com/v1/private/business-units/${businessUnit}/reviews?${params}`,
      { headers: secret instanceof Object && "accessToken" in secret
        ? { Authorization: `Bearer ${(secret as OAuthSecret).accessToken}` }
        : {} },
    )
    const data = await res.json()

    return (data.reviews ?? []).map((r: Record<string, unknown>) => ({
      externalId:   r.id as string,
      platform:     this.platform,
      authorName:   (r.consumer as Record<string, string>)?.displayName ?? "Trustpilot User",
      rating:       r.stars as number,
      title:        r.title as string,
      body:         r.text as string ?? "",
      reviewedAt:   new Date(r.createdAt as string),
      locationName: config.locationName,
      isVerified:   true,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { accessToken } = secret as OAuthSecret
    await fetch(
      `https://api.trustpilot.com/v1/private/reviews/${reviewId}/reply`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: response }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// G2
// Docs: https://data.g2.com/api/docs
// Auth: API Key
// ─────────────────────────────────────────────────────────────────────────────
export class G2Adapter extends BasePortalAdapter {
  readonly platform    = "G2"
  readonly displayName = "G2"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch("https://data.g2.com/api/v1/products?page[size]=1", {
      headers: { Authorization: `Token ${apiKey}` },
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey }  = secret as ApiKeySecret
    const productSlug  = config.productId   // G2 product slug e.g. "salesforce"

    const params = new URLSearchParams({
      "filter[product_slug]": productSlug,
      "page[size]":           "50",
      "sort":                 "-created_at",
    })

    const res  = await fetch(
      `https://data.g2.com/api/v1/survey-responses?${params}`,
      { headers: { Authorization: `Token ${apiKey}` } },
    )
    const data = await res.json()

    return (data.data ?? []).map((r: Record<string, unknown>) => {
      const attrs = r.attributes as Record<string, unknown> ?? {}
      return {
        externalId:   r.id as string,
        platform:     this.platform,
        authorName:   attrs.reviewer_title as string ?? "G2 Reviewer",
        rating:       Math.round((attrs.star_rating as number ?? 0) / 2), // G2 uses 0-10 → 1-5
        title:        attrs.title as string,
        body:         ([
          attrs.love as string && `👍 ${attrs.love}`,
          attrs.hate as string && `👎 ${attrs.hate}`,
        ].filter(Boolean).join("\n") || (attrs.comment_answers as string)) ?? "",
        reviewedAt:   new Date(attrs.submitted_at as string),
        productId:    productSlug,
        productName:  config.productName,
        isVerified:   attrs.is_verified as boolean ?? false,
        metadata:     attrs,
      }
    })
  }

  async publishResponse(): Promise<void> {
    console.log("G2: vendor responses managed via G2 My Profile dashboard")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Capterra
// Docs: https://www.capterra.com/vendor-support/api/
// Auth: API Key
// ─────────────────────────────────────────────────────────────────────────────
export class CapterraAdapter extends BasePortalAdapter {
  readonly platform    = "CAPTERRA"
  readonly displayName = "Capterra"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch("https://www.capterra.com/api/v1/software?page=1&limit=1", {
      headers: { "X-Api-Key": apiKey },
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey }  = secret as ApiKeySecret
    const productId    = config.productId  // Capterra product/software ID

    const res = await fetch(
      `https://www.capterra.com/api/v1/software/${productId}/reviews?limit=50&sort=-date`,
      { headers: { "X-Api-Key": apiKey } },
    )
    const data = await res.json()

    return (data.reviews ?? data.data ?? []).map((r: Record<string, unknown>) => ({
      externalId:   String(r.id ?? r.review_id),
      platform:     this.platform,
      authorName:   r.reviewer_name as string ?? "Capterra Reviewer",
      rating:       Math.round(r.overall_rating as number ?? r.rating as number ?? 3),
      title:        r.title as string,
      body:         [
        r.pros   as string && `Pros: ${r.pros}`,
        r.cons   as string && `Cons: ${r.cons}`,
        r.review as string,
      ].filter(Boolean).join("\n") ?? "",
      reviewedAt:   new Date(r.date as string ?? r.created_at as string),
      productId,
      productName:  config.productName,
      isVerified:   r.verified as boolean ?? true,
      metadata:     r,
    }))
  }

  async publishResponse(): Promise<void> {
    console.log("Capterra: vendor responses via Capterra Vendor portal")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Flipkart (India)
// Docs: https://seller.flipkart.com/api-docs/order-api-docs/swagger-flipkart-product-reviews-1
// Auth: API Key (Flipkart Seller API)
// ─────────────────────────────────────────────────────────────────────────────
export class FlipkartAdapter extends BasePortalAdapter {
  readonly platform    = "FLIPKART"
  readonly displayName = "Flipkart"
  readonly authModes   = ["API_KEY"] as const

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch("https://api.flipkart.net/sellers/listings/v3/filter/get", {
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })
    return res.status !== 401
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const { apiKey } = secret as ApiKeySecret
    const skuId       = config.productId  // Flipkart SKU / listing ID

    const params = new URLSearchParams({
      listing_id: skuId,
      page_size:  "50",
      page_no:    "1",
    })

    const res  = await fetch(
      `https://api.flipkart.net/sellers/v3/reviews/listing?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    const data = await res.json()

    return (data.reviewList ?? data.reviews ?? []).map((r: Record<string, unknown>) => ({
      externalId:   r.reviewId as string,
      platform:     this.platform,
      authorName:   r.reviewerName as string ?? "Flipkart Customer",
      rating:       r.rating as number,
      title:        r.headline as string,
      body:         r.reviewText as string ?? "",
      reviewedAt:   new Date(r.reviewDate as string),
      productId:    skuId,
      productName:  config.productName,
      isVerified:   r.certifiedBuyer as boolean ?? false,
      metadata:     r,
    }))
  }

  async publishResponse(reviewId: string, response: string, secret: PortalSecret): Promise<void> {
    const { apiKey } = secret as ApiKeySecret
    await fetch(
      `https://api.flipkart.net/sellers/v3/reviews/${reviewId}/seller-response`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response }),
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductHunt
// Docs: https://api.producthunt.com/v2/docs
// Auth: OAuth 2.0 (developer token or user OAuth)
// Strategy: Fetch product comments and upvote data
// ─────────────────────────────────────────────────────────────────────────────
export class ProductHuntAdapter extends BasePortalAdapter {
  readonly platform    = "PRODUCTHUNT"
  readonly displayName = "ProductHunt"
  readonly authModes   = ["OAUTH", "API_KEY"] as const

  readonly oauthConfig: OAuthConfig = {
    clientId:     process.env.PRODUCTHUNT_CLIENT_ID ?? "",
    clientSecret: process.env.PRODUCTHUNT_CLIENT_SECRET ?? "",
    redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/producthunt`,
    scopes:       ["public", "private"],
  }

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     this.oauthConfig.clientId,
      redirect_uri:  this.oauthConfig.redirectUri,
      response_type: "code",
      scope:         this.oauthConfig.scopes.join(" "),
      state,
    })
    return `https://api.producthunt.com/v2/oauth/authorize?${params}`
  }

  async exchangeOAuthCode(code: string) {
    const res = await fetch("https://api.producthunt.com/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:     this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri:  this.oauthConfig.redirectUri,
        grant_type:    "authorization_code",
        code,
      }),
    })
    const data = await res.json()
    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? data.access_token,
      expiresAt:    new Date(Date.now() + (data.expires_in ?? 31536000) * 1000),
      tokenType:    "Bearer",
      scope:        "public private",
    }
  }

  async refreshOAuthToken(refreshToken: string) {
    return { accessToken: refreshToken, expiresAt: new Date(Date.now() + 31536000 * 1000) }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "{ viewer { id } }" }),
    })
    return res.ok
  }

  async fetchReviews(
    secret: PortalSecret,
    config: Record<string, string>,
    since?: Date,
  ): Promise<NormalizedReview[]> {
    const token    = (secret as OAuthSecret).accessToken ?? (secret as ApiKeySecret).apiKey
    const productSlug = config.productId

    const query = `{
      post(slug: "${productSlug}") {
        id name tagline votesCount
        comments(first: 50, order: NEWEST) {
          edges {
            node {
              id body createdAt
              user { name headline profileImage }
              votes { totalCount }
            }
          }
        }
      }
    }`

    const res  = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    })
    const data = await res.json()
    const comments = data?.data?.post?.comments?.edges ?? []

    return comments.map(({ node: c }: { node: Record<string, unknown> }) => {
      const votes  = (c.votes as Record<string, number>)?.totalCount ?? 0
      const rating = votes > 10 ? 5 : votes > 3 ? 4 : 3
      return {
        externalId:   c.id as string,
        platform:     this.platform,
        authorName:   (c.user as Record<string, string>)?.name ?? "Product Hunter",
        authorAvatar: (c.user as Record<string, string>)?.profileImage,
        rating,
        body:         c.body as string ?? "",
        reviewedAt:   new Date(c.createdAt as string),
        productId:    productSlug,
        productName:  config.productName ?? data?.data?.post?.name,
        isVerified:   false,
        metadata:     c,
      }
    })
  }

  async publishResponse(commentId: string, response: string, secret: PortalSecret): Promise<void> {
    const token = (secret as OAuthSecret).accessToken ?? (secret as ApiKeySecret).apiKey
    const mutation = `
      mutation {
        createComment(input: { body: "${response.replace(/"/g, '\\"')}", commentableId: "${commentId}", commentableType: "Comment" }) {
          comment { id }
          errors { field message }
        }
      }
    `
    await fetch("https://api.producthunt.com/v2/api/graphql", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: mutation }),
    })
  }
}
