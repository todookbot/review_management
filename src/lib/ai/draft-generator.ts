import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { db } from "@/db"
import { reviews, reviewTags, responseDrafts, tenants } from "@/db/schema"
import { eq } from "drizzle-orm"
import { sendDraftPendingApproval } from "@/lib/aws/ses"
import { enqueue } from "@/lib/aws/sqs"
import type { NewResponseDraft } from "@/db/schema"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Build the system prompt using the tenant's brand voice and review context.
 */
function buildSystemPrompt(opts: {
  brandName:     string
  platform:      string
  locationName?: string
  rating:        number
  sentiment:     string
  topics:        string[]
  intent:        string
}): string {
  const tone = opts.rating >= 4
    ? "warm and appreciative"
    : opts.rating === 3
    ? "empathetic and constructive"
    : "sincere, apologetic, and solution-focused"

  return `You are the official response manager for ${opts.brandName}.

Your task is to write a professional, ${tone} response to a customer review on ${opts.platform}${opts.locationName ? ` (${opts.locationName})` : ""}.

Guidelines:
- Keep the response between 60-120 words
- Always thank the customer by name if provided
- Address the specific topics mentioned: ${opts.topics.join(", ")}
- Intent of review: ${opts.intent}
- Rating: ${opts.rating}/5 stars — Sentiment: ${opts.sentiment}
- Do NOT be defensive or make excuses for genuine failures
- For negative reviews: acknowledge, apologize, offer resolution
- For positive reviews: thank sincerely, reinforce strengths, invite return
- End with an inviting closing or call to action
- Sound human — not like a template
- Do NOT include the customer's name if not known — use "valued customer"
- Sign off with just "${opts.brandName} Team"`
}

/**
 * Generate draft via Claude.
 */
async function generateWithClaude(
  systemPrompt: string,
  reviewBody:   string,
  authorName:   string,
): Promise<{ body: string; model: string }> {
  const model = "claude-3-5-sonnet-20241022"
  const message = await anthropic.messages.create({
    model,
    max_tokens: 300,
    system:     systemPrompt,
    messages: [{
      role:    "user",
      content: `Write a response to this review by ${authorName || "a customer"}:\n\n"${reviewBody}"`,
    }],
  })
  const body = (message.content[0] as { type: string; text: string }).text.trim()
  return { body, model }
}

/**
 * Generate draft via OpenAI.
 */
async function generateWithOpenAI(
  systemPrompt: string,
  reviewBody:   string,
  authorName:   string,
): Promise<{ body: string; model: string }> {
  const model = "gpt-4o-mini"
  const completion = await openaiClient.chat.completions.create({
    model,
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Write a response to this review by ${authorName || "a customer"}:\n\n"${reviewBody}"` },
    ],
  })
  const body = completion.choices[0]?.message?.content?.trim() ?? ""
  return { body, model }
}

/**
 * Full draft generation pipeline:
 * 1. Load review + tags from DB
 * 2. Build brand-voice prompt
 * 3. Generate with Claude or OpenAI (based on tenant setting)
 * 4. Save draft to DB
 * 5. Notify approvers via SES
 */
export async function generateResponseDraft(
  reviewId:      string,
  tenantId:      string,
  aiProvider:    "CLAUDE" | "OPENAI" = "CLAUDE",
): Promise<string> {
  // Load review
  const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1)
  if (!review) throw new Error("Review not found")

  // Load tenant
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) throw new Error("Tenant not found")

  // Load NLP tags
  const tags = await db.select().from(reviewTags).where(eq(reviewTags.reviewId, reviewId))

  const sentiment = tags.find(t => t.tagType === "SENTIMENT")?.value ?? "NEUTRAL"
  const topics    = tags.filter(t => t.tagType === "TOPIC").map(t => t.value)
  const intent    = tags.find(t => t.tagType === "INTENT")?.value ?? "COMPLAINT"

  const systemPrompt = buildSystemPrompt({
    brandName:    tenant.brandName ?? tenant.name,
    platform:     review.platform,
    locationName: review.locationName ?? undefined,
    rating:       review.rating ?? 3,
    sentiment,
    topics,
    intent,
  })

  // Generate draft
  let result: { body: string; model: string }
  if (aiProvider === "OPENAI") {
    result = await generateWithOpenAI(systemPrompt, review.body ?? "", review.authorName ?? "")
  } else {
    result = await generateWithClaude(systemPrompt, review.body ?? "", review.authorName ?? "")
  }

  // Save draft
  const draftData: NewResponseDraft = {
    reviewId,
    tenantId,
    body:         result.body,
    aiProvider,
    model:        result.model,
    promptVersion: "v1",
    status:       "DRAFT",
  }
  const [draft] = await db.insert(responseDrafts).values(draftData).returning()

  // Update review status
  await db
    .update(reviews)
    .set({ status: "DRAFT_CREATED", updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))

  return draft.id
}
