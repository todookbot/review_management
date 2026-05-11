import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { responseDrafts, reviews } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getAdapter } from "@/lib/portals"
import { getPortalSecret } from "@/lib/aws/secrets-manager"
import { db as dbClient } from "@/db"
import { reviewSources } from "@/db/schema"

// GET /api/drafts/[id] — fetch a single draft with its review
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [draft] = await db
    .select()
    .from(responseDrafts)
    .where(eq(responseDrafts.id, id))
    .limit(1)

  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, draft.reviewId))
    .limit(1)

  return NextResponse.json({ draft, review })
}

// PATCH /api/drafts/[id] — update draft body
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json()
  const { draftBody, userId } = body

  const [updated] = await db
    .update(responseDrafts)
    .set({
      body:         draftBody,
      bodyEditedBy: userId,
      bodyEditedAt: new Date(),
      updatedAt:    new Date(),
    })
    .where(eq(responseDrafts.id, id))
    .returning()

  return NextResponse.json({ draft: updated })
}
