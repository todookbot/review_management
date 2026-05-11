import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { responseDrafts, reviews, reviewSources } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAdapter } from "@/lib/portals"
import { getPortalSecret } from "@/lib/aws/secrets-manager"

// POST /api/drafts/[id]/approve — approve and optionally publish
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }    = await params
  const body      = await req.json()
  const userId    = body.userId as string
  const publish   = body.publish as boolean ?? true // auto-publish on approve

  const [draft] = await db
    .select()
    .from(responseDrafts)
    .where(eq(responseDrafts.id, id))
    .limit(1)

  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 })

  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, draft.reviewId))
    .limit(1)

  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })

  if (publish) {
    // Attempt to publish the response back to the platform
    try {
      const [source] = await db
        .select()
        .from(reviewSources)
        .where(eq(reviewSources.id, review.sourceId))
        .limit(1)

      if (source?.secretArn) {
        const secret  = await getPortalSecret(source.secretArn)
        const adapter = getAdapter(review.platform)
        await adapter.publishResponse(review.externalId, draft.body, secret)
      }

      // Mark as published
      await db
        .update(responseDrafts)
        .set({
          status:      "PUBLISHED",
          approvedBy:  userId,
          approvedAt:  new Date(),
          publishedAt: new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(responseDrafts.id, id))

      await db
        .update(reviews)
        .set({ status: "RESPONDED", updatedAt: new Date() })
        .where(eq(reviews.id, draft.reviewId))

      return NextResponse.json({ success: true, status: "PUBLISHED" })
    } catch (err) {
      // Publishing failed — mark draft as failed but still approved
      await db
        .update(responseDrafts)
        .set({
          status:       "FAILED",
          approvedBy:   userId,
          approvedAt:   new Date(),
          publishError: String(err),
          updatedAt:    new Date(),
        })
        .where(eq(responseDrafts.id, id))

      return NextResponse.json({ error: "Publishing failed", details: String(err) }, { status: 500 })
    }
  } else {
    // Just approve, don't publish yet
    await db
      .update(responseDrafts)
      .set({
        status:     "APPROVED",
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt:  new Date(),
      })
      .where(eq(responseDrafts.id, id))

    return NextResponse.json({ success: true, status: "APPROVED" })
  }
}
