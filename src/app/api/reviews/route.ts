import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { reviews, reviewTags, responseDrafts, tenants } from "@/db/schema"
import { eq, and, desc, ilike, gte, lte, inArray } from "drizzle-orm"
import { z } from "zod"

const querySchema = z.object({
  tenantId:    z.string().uuid().optional(),
  platform:    z.string().optional(),
  status:      z.string().optional(),
  rating:      z.coerce.number().min(1).max(5).optional(),
  ratingMin:   z.coerce.number().min(1).max(5).optional(),
  ratingMax:   z.coerce.number().min(1).max(5).optional(),
  isUrgent:    z.coerce.boolean().optional(),
  locationId:  z.string().optional(),
  productId:   z.string().optional(),
  search:      z.string().optional(),
  dateFrom:    z.string().optional(),
  dateTo:      z.string().optional(),
  page:        z.coerce.number().default(1),
  limit:       z.coerce.number().default(20),
})

// Helper: fetch real Google My Business reviews using locally stored token
async function fetchRealGoogleReviews(): Promise<any[] | null> {
  try {
    const { getLatestGoogleToken } = require("@/lib/local-storage")
    const tokenData = getLatestGoogleToken()
    if (!tokenData) return null

    const accessToken = tokenData.token.accessToken

    // Get accounts
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!accountsRes.ok) return null
    const accountsData = await accountsRes.json()
    const account = accountsData.accounts?.[0]
    if (!account) return null

    // Get locations
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const locData = await locRes.json()
    const location = locData.locations?.[0]
    if (!location) return null

    // Fetch reviews
    const reviewsRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${location.name}/reviews?pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!reviewsRes.ok) return null
    const reviewsData = await reviewsRes.json()
    if (!reviewsData.reviews?.length) return []

    const starMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

    return reviewsData.reviews.map((r: any) => ({
      id:           r.reviewId,
      platform:     "GOOGLE_MY_BUSINESS",
      rating:       starMap[r.starRating] ?? 3,
      status:       "NEW",
      isUrgent:     (starMap[r.starRating] ?? 3) <= 2,
      authorName:   r.reviewer?.displayName ?? "Anonymous",
      reviewedAt:   r.createTime,
      locationName: location.title ?? account.name,
      body:         r.comment ?? "(No comment left)",
      replyText:    r.reviewReply?.comment ?? null,
      tags:         [],
      hasDraft:     false,
    }))
  } catch (err) {
    console.warn("[reviews] Real Google fetch error:", err)
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const query  = querySchema.parse(params)

    let tenantId = query.tenantId
    if (!tenantId) {
      const [first] = await db.select({ id: tenants.id }).from(tenants).limit(1)
      tenantId = first?.id
    }
    if (!tenantId) return NextResponse.json({ reviews: [] })

    const conditions = [eq(reviews.tenantId, tenantId)]
    if (query.platform)   conditions.push(eq(reviews.platform, query.platform))
    if (query.status)     conditions.push(eq(reviews.status, query.status as "NEW"))
    if (query.isUrgent !== undefined) conditions.push(eq(reviews.isUrgent, query.isUrgent))
    if (query.locationId) conditions.push(eq(reviews.locationId!, query.locationId))
    if (query.productId)  conditions.push(eq(reviews.productId!, query.productId))
    if (query.ratingMin)  conditions.push(gte(reviews.rating!, query.ratingMin))
    if (query.ratingMax)  conditions.push(lte(reviews.rating!, query.ratingMax))
    if (query.dateFrom)   conditions.push(gte(reviews.reviewedAt!, new Date(query.dateFrom)))
    if (query.dateTo)     conditions.push(lte(reviews.reviewedAt!, new Date(query.dateTo)))
    if (query.search)     conditions.push(ilike(reviews.body!, `%${query.search}%`))

    const offset = (query.page - 1) * query.limit

    const rows = await db
      .select()
      .from(reviews)
      .where(and(...conditions))
      .orderBy(desc(reviews.reviewedAt))
      .limit(query.limit)
      .offset(offset)

    const reviewIds = rows.map(r => r.id)
    const [tags, drafts] = reviewIds.length
      ? await Promise.all([
          db.select().from(reviewTags).where(inArray(reviewTags.reviewId, reviewIds)),
          db.select({ reviewId: responseDrafts.reviewId }).from(responseDrafts).where(inArray(responseDrafts.reviewId, reviewIds)),
        ])
      : [[], []]

    const draftSet = new Set(drafts.map(d => d.reviewId))
    const tagsByReview = tags.reduce((acc, tag) => {
      if (!acc[tag.reviewId]) acc[tag.reviewId] = []
      acc[tag.reviewId].push(tag)
      return acc
    }, {} as Record<string, typeof tags>)

    const enriched = rows.map(r => ({
      ...r,
      tags:     tagsByReview[r.id] ?? [],
      hasDraft: draftSet.has(r.id),
    }))

    return NextResponse.json({ reviews: enriched, page: query.page, limit: query.limit })
  } catch (err) {
    console.error("DB unavailable in /api/reviews, trying real Google reviews:", err)

    // Try fetching real Google My Business reviews
    const googleReviews = await fetchRealGoogleReviews()
    if (googleReviews !== null && googleReviews.length > 0) {
      return NextResponse.json({ reviews: googleReviews, page: 1, limit: 50, source: "google_live" })
    }

    // Final fallback: mock data
    return NextResponse.json({
      reviews: [
        {
          id: "gmb-mock-1",
          platform: "GOOGLE_MY_BUSINESS",
          rating: 5,
          status: "NEW",
          isUrgent: false,
          authorName: "Priya Sharma",
          reviewedAt: new Date(Date.now() - 1800000).toISOString(),
          locationName: "My Business",
          body: "Absolutely fantastic service! The team was incredibly responsive and went above and beyond to help me.",
          tags: [
            { tagType: "SENTIMENT", value: "POSITIVE" },
            { tagType: "TOPIC",     value: "staff_behavior" },
            { tagType: "URGENCY",   value: "LOW" },
            { tagType: "INTENT",    value: "PRAISE" },
          ],
          hasDraft: false,
        },
        {
          id: "gmb-mock-2",
          platform: "GOOGLE_MY_BUSINESS",
          rating: 1,
          status: "NEW",
          isUrgent: true,
          authorName: "Rajesh Kumar",
          reviewedAt: new Date(Date.now() - 3600000).toISOString(),
          locationName: "My Business",
          body: "Terrible experience. I waited over 30 minutes and nobody acknowledged me.",
          tags: [
            { tagType: "SENTIMENT", value: "NEGATIVE" },
            { tagType: "TOPIC",     value: "service_speed" },
            { tagType: "URGENCY",   value: "CRITICAL" },
            { tagType: "INTENT",    value: "COMPLAINT" },
          ],
          hasDraft: false,
        },
        {
          id: "gmb-mock-3",
          platform: "GOOGLE_MY_BUSINESS",
          rating: 4,
          status: "DRAFT_CREATED",
          isUrgent: false,
          authorName: "Ananya Patel",
          reviewedAt: new Date(Date.now() - 7200000).toISOString(),
          locationName: "My Business",
          body: "Great overall experience. The product quality is top-notch and delivery was faster than expected.",
          tags: [
            { tagType: "SENTIMENT", value: "POSITIVE" },
            { tagType: "TOPIC",     value: "food_quality" },
            { tagType: "URGENCY",   value: "LOW" },
            { tagType: "INTENT",    value: "PRAISE" },
          ],
          hasDraft: true,
        },
      ],
      page: 1,
      limit: 20,
      source: "mock",
    })
  }
}
