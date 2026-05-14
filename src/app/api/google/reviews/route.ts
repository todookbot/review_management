import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getLatestGoogleToken } from "@/lib/local-storage"

// GET /api/google/reviews?accountId=...&locationId=...
// Fetches REAL reviews from Google My Business API using stored token
export async function GET(req: NextRequest) {
  try {
    let tokenData = null;

    try {
      const client = await clientPromise;
      const dbMongo = client.db();
      const tokensCollection = dbMongo.collection("tokens");
      
      const mongoToken = await tokensCollection.find({ platform: "GOOGLE_MY_BUSINESS" })
        .sort({ savedAt: -1 })
        .limit(1)
        .toArray();
      
      if (mongoToken && mongoToken.length > 0) {
        tokenData = { sourceId: mongoToken[0].sourceId, token: mongoToken[0] };
      }
    } catch (mongoErr) {
      console.error("[Google Reviews] Failed to fetch token from MongoDB:", mongoErr);
    }

    if (!tokenData) {
      tokenData = getLatestGoogleToken()
    }

    if (!tokenData) {
      return NextResponse.json(
        { error: "No Google token found. Please connect your Google My Business account first." },
        { status: 401 }
      )
    }

    const { token } = tokenData
    const accessToken = token.accessToken

    // Step 1: Get accounts
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const accountsData = await accountsRes.json()

    if (!accountsRes.ok) {
      console.error("[Google Reviews] Accounts fetch failed:", accountsData)
      return NextResponse.json({ error: "Failed to fetch Google accounts", details: accountsData }, { status: 502 })
    }

    const account = accountsData.accounts?.[0]
    if (!account) {
      return NextResponse.json({ reviews: [], message: "No Google My Business accounts found" })
    }

    // Step 2: Get locations
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const locData = await locRes.json()
    const location = locData.locations?.[0]

    if (!location) {
      return NextResponse.json({ reviews: [], message: "No locations found for this account", account: account.name })
    }

    // Step 3: Fetch reviews
    const reviewsRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${location.name}/reviews?pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const reviewsData = await reviewsRes.json()

    if (!reviewsRes.ok) {
      console.error("[Google Reviews] Reviews fetch failed:", reviewsData)
      return NextResponse.json({ error: "Failed to fetch reviews", details: reviewsData }, { status: 502 })
    }

    const starMap: Record<string, number> = {
      ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5
    }

    const reviews = (reviewsData.reviews ?? []).map((r: any) => ({
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
      reviewUrl:    r.name,
      tags:         [],
      hasDraft:     false,
    }))

    return NextResponse.json({
      reviews,
      account:  account.name,
      location: location.title,
      total:    reviews.length,
    })
  } catch (err: any) {
    console.error("[Google Reviews] Error:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 })
  }
}
