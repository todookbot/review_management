import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { responseDrafts, reviews } from "@/db/schema"
import { eq } from "drizzle-orm"
import { enqueue, type AiDraftMessage } from "@/lib/aws/sqs"

// POST /api/drafts/[id]/reject
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body   = await req.json()
  const userId = body.userId as string
  const reason = body.reason as string
  const regenerate = body.regenerate as boolean ?? false

  const [draft] = await db
    .select()
    .from(responseDrafts)
    .where(eq(responseDrafts.id, id))
    .limit(1)

  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db
    .update(responseDrafts)
    .set({
      status:          "REJECTED",
      rejectedBy:      userId,
      rejectedAt:      new Date(),
      rejectionReason: reason,
      updatedAt:       new Date(),
    })
    .where(eq(responseDrafts.id, id))

  // Optionally re-trigger AI generation with same or alternate provider
  if (regenerate) {
    const nextProvider: "CLAUDE" | "OPENAI" =
      draft.aiProvider === "CLAUDE" ? "OPENAI" : "CLAUDE"

    const msg: AiDraftMessage = {
      tenantId:   draft.tenantId,
      reviewId:   draft.reviewId,
      aiProvider: nextProvider,
    }
    await enqueue("AI_DRAFT", msg)

    await db
      .update(reviews)
      .set({ status: "IN_PROGRESS", updatedAt: new Date() })
      .where(eq(reviews.id, draft.reviewId))
  }

  return NextResponse.json({ success: true, regenerating: regenerate })
}
