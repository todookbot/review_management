/**
 * Lambda: NLP Processor
 * Trigger: SQS nlp-tagging-queue
 *
 * 1. Runs AWS Comprehend + Claude NLP on the review
 * 2. Persists tags
 * 3. If autoDraft enabled → enqueue into ai-draft-queue
 */

import { processReviewNlp } from "@/lib/ai/nlp"
import { enqueue, type AiDraftMessage, type NlpTaggingMessage } from "@/lib/aws/sqs"
import { db } from "@/db"
import { reviews, tenants } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { Handler, SQSEvent } from "aws-lambda"

export const handler: Handler<SQSEvent> = async (event) => {
  await Promise.allSettled(
    event.Records.map(async (record) => {
      const message: NlpTaggingMessage = JSON.parse(record.body)
      const { tenantId, reviewId } = message

      console.log(`Processing NLP for review: ${reviewId}`)

      // Run full NLP pipeline
      await processReviewNlp(reviewId)

      // Load tenant settings to check autoDraft
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1)

      const settings = tenant?.settings as {
        autoDraft?:         boolean
        defaultAiProvider?: "CLAUDE" | "OPENAI"
      } | undefined

      if (settings?.autoDraft !== false) {
        const aiProvider = settings?.defaultAiProvider ?? "CLAUDE"
        const draftMessage: AiDraftMessage = { tenantId, reviewId, aiProvider }
        await enqueue("AI_DRAFT", draftMessage)
        console.log(`Enqueued AI draft generation for review: ${reviewId}`)
      }
    }),
  )
}
