import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { reviewSources } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getAdapter } from "@/lib/portals"
import { enqueue, type ReviewIngestionMessage } from "@/lib/aws/sqs"

// POST /api/webhooks/[tenantId]/[sourceId]
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; sourceId: string }> },
) {
  const { tenantId, sourceId } = await params

  // Load source
  const [source] = await db
    .select()
    .from(reviewSources)
    .where(and(
      eq(reviewSources.id, sourceId),
      eq(reviewSources.tenantId, tenantId),
    ))
    .limit(1)

  if (!source || !source.isActive) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 })
  }

  const rawBody  = await req.text()
  const signature = req.headers.get("x-hub-signature-256")
    ?? req.headers.get("x-yelp-signature")
    ?? req.headers.get("x-signature")
    ?? ""

  const adapter = getAdapter(source.platform)

  // Verify signature if adapter supports it
  if (adapter.verifyWebhookSignature && source.webhookSecret) {
    const isValid = adapter.verifyWebhookSignature(rawBody, signature, source.webhookSecret)
    if (!isValid) {
      console.warn(`Webhook signature invalid for source ${sourceId}`)
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>

  // Normalize event
  if (!adapter.normalizeWebhookEvent) {
    return NextResponse.json({ error: "Adapter does not support webhooks" }, { status: 400 })
  }

  const normalized = adapter.normalizeWebhookEvent(payload)
  if (!normalized) {
    // Non-review event (e.g. ping) — acknowledge silently
    return NextResponse.json({ received: true })
  }

  // Enqueue for ingestion
  const message: ReviewIngestionMessage = {
    tenantId,
    sourceId,
    platform:  source.platform,
    rawReview: { ...normalized, metadata: payload },
  }
  await enqueue("REVIEW_INGESTION", message)

  return NextResponse.json({ received: true })
}
