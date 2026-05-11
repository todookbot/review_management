import Anthropic from "@anthropic-ai/sdk"
import { analyzeReview as comprehendAnalyze } from "@/lib/aws/comprehend"
import { db } from "@/db"
import { reviewTags, reviews } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { NewReviewTag } from "@/db/schema"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ClaudeNlpResult {
  topics:   Array<{ value: string; score: number }>
  urgency:  { value: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; score: number }
  intent:   { value: "COMPLAINT" | "PRAISE" | "SUGGESTION" | "QUESTION"; score: number }
  entities: Array<{ type: "ENTITY_PERSON" | "ENTITY_PRODUCT" | "ENTITY_LOCATION"; value: string; score: number }>
  summary:  string
}

/**
 * Run Claude NLP to extract topics, urgency, intent, entities from a review.
 */
async function claudeNlpAnalysis(
  reviewBody: string,
  platform:   string,
  rating:     number,
): Promise<ClaudeNlpResult> {
  const prompt = `You are an NLP analyzer for customer reviews. Analyze the following review and return a JSON object.

Platform: ${platform}
Rating: ${rating}/5
Review: "${reviewBody}"

Return ONLY valid JSON in this exact structure:
{
  "topics": [{ "value": "food_quality", "score": 0.95 }, ...],
  "urgency": { "value": "HIGH", "score": 0.88 },
  "intent": { "value": "COMPLAINT", "score": 0.91 },
  "entities": [{ "type": "ENTITY_PERSON", "value": "John the waiter", "score": 0.85 }, ...],
  "summary": "Customer complained about cold food and slow service, but praised the ambiance."
}

Topic values must be from: food_quality, service_speed, staff_behavior, cleanliness, ambiance, price_value,
product_quality, delivery, packaging, app_experience, location_accessibility, wait_time, communication.

Urgency: CRITICAL (1★ + serious issue), HIGH (1-2★ or safety), MEDIUM (3★ or moderate), LOW (4-5★ positive).
Intent: COMPLAINT (issue raised), PRAISE (positive), SUGGESTION (improvement idea), QUESTION (asking something).`

  const message = await anthropic.messages.create({
    model:      "claude-3-5-haiku-20241022",
    max_tokens: 512,
    messages:   [{ role: "user", content: prompt }],
  })

  const text = (message.content[0] as { type: string; text: string }).text
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Claude NLP: no JSON in response")
  return JSON.parse(jsonMatch[0]) as ClaudeNlpResult
}

/**
 * Full NLP pipeline for a review:
 * 1. AWS Comprehend — sentiment, key phrases, entities, language
 * 2. Claude — topics, urgency, intent, named entities
 * 3. Persist all tags to DB
 */
export async function processReviewNlp(reviewId: string): Promise<void> {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)

  if (!review || !review.body) return

  const tags: NewReviewTag[] = []

  // ── 1. AWS Comprehend ────────────────────────────────────────────────────
  try {
    const comprehend = await comprehendAnalyze(review.body)

    // Language tag
    tags.push({
      reviewId,
      tagType:  "LANGUAGE",
      value:    comprehend.language,
      score:    1.0,
      source:   "AWS_COMPREHEND",
    })

    // Sentiment tag
    tags.push({
      reviewId,
      tagType:  "SENTIMENT",
      value:    comprehend.sentiment,
      score:    Math.max(
        comprehend.sentimentScores.positive,
        comprehend.sentimentScores.negative,
        comprehend.sentimentScores.neutral,
        comprehend.sentimentScores.mixed,
      ),
      source:   "AWS_COMPREHEND",
    })

    // Entity tags from Comprehend
    for (const entity of comprehend.entities.slice(0, 5)) {
      const tagType = entity.type === "PERSON"
        ? "ENTITY_PERSON"
        : entity.type === "LOCATION"
        ? "ENTITY_LOCATION"
        : "ENTITY_PRODUCT"

      tags.push({
        reviewId,
        tagType,
        value:  entity.text,
        score:  entity.score,
        source: "AWS_COMPREHEND",
      })
    }
  } catch (err) {
    console.error("Comprehend analysis failed:", err)
  }

  // ── 2. Claude NLP ────────────────────────────────────────────────────────
  try {
    const claudeResult = await claudeNlpAnalysis(
      review.body,
      review.platform,
      review.rating ?? 3,
    )

    // Topic tags
    for (const topic of claudeResult.topics) {
      tags.push({
        reviewId,
        tagType:  "TOPIC",
        value:    topic.value,
        score:    topic.score,
        source:   "CLAUDE",
      })
    }

    // Urgency tag
    tags.push({
      reviewId,
      tagType:  "URGENCY",
      value:    claudeResult.urgency.value,
      score:    claudeResult.urgency.score,
      source:   "CLAUDE",
    })

    // Intent tag
    tags.push({
      reviewId,
      tagType:  "INTENT",
      value:    claudeResult.intent.value,
      score:    claudeResult.intent.score,
      source:   "CLAUDE",
    })

    // Entity tags from Claude
    for (const entity of claudeResult.entities) {
      tags.push({
        reviewId,
        tagType:  entity.type,
        value:    entity.value,
        score:    entity.score,
        source:   "CLAUDE",
      })
    }

    // Mark urgent if CRITICAL or HIGH urgency
    const isUrgent =
      claudeResult.urgency.value === "CRITICAL" ||
      claudeResult.urgency.value === "HIGH" ||
      (review.rating !== null && review.rating <= 2)

    // Update review: mark processed, set urgency, update language
    await db
      .update(reviews)
      .set({
        isProcessed: true,
        isUrgent,
        language:    tags.find(t => t.tagType === "LANGUAGE")?.value ?? review.language,
        updatedAt:   new Date(),
      })
      .where(eq(reviews.id, reviewId))
  } catch (err) {
    console.error("Claude NLP analysis failed:", err)
  }

  // ── 3. Persist tags ───────────────────────────────────────────────────────
  if (tags.length > 0) {
    await db.insert(reviewTags).values(tags)
  }
}
