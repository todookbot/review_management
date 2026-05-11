/**
 * Lambda: Review Ingestion Consumer
 * Trigger: SQS review-ingestion-queue
 *
 * 1. Reads normalized review from SQS message
 * 2. Deduplicates by externalId
 * 3. Stores in RDS (reviews table)
 * 4. Saves raw payload to S3
 * 5. Enqueues into nlp-tagging-queue
 */

import { db } from "@/db"
import { reviews, reviewSources } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { storeRawPayload } from "@/lib/aws/s3"
import { enqueue, type ReviewIngestionMessage, type NlpTaggingMessage } from "@/lib/aws/sqs"
import { sendNewReviewAlert } from "@/lib/aws/ses"
import type { Handler, SQSEvent } from "aws-lambda"

export const handler: Handler<SQSEvent> = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map(async (record) => {
      const message: ReviewIngestionMessage = JSON.parse(record.body)
      const { tenantId, sourceId, platform, rawReview } = message

      // Load source config
      const [source] = await db
        .select()
        .from(reviewSources)
        .where(and(eq(reviewSources.id, sourceId), eq(reviewSources.tenantId, tenantId)))
        .limit(1)

      if (!source) {
        console.error(`Source not found: ${sourceId}`)
        return
      }

      const normalized = rawReview as {
        externalId:   string
        authorName:   string
        authorAvatar?: string
        authorId?:    string
        rating:       number
        title?:       string
        body:         string
        reviewedAt:   string
        isVerified:   boolean
        locationId?:  string
        locationName?: string
        productId?:   string
        productName?: string
        metadata:     Record<string, unknown>
      }

      // Deduplicate
      const existing = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(
          eq(reviews.tenantId, tenantId),
          eq(reviews.externalId, normalized.externalId),
          eq(reviews.platform, platform),
        ))
        .limit(1)

      if (existing.length > 0) {
        console.log(`Duplicate review skipped: ${normalized.externalId}`)
        return
      }

      // Store raw payload in S3
      const s3Key = await storeRawPayload(
        tenantId,
        platform,
        normalized.externalId,
        normalized.metadata,
      )

      // Urgency check
      const urgencyThreshold = (source as { config?: Record<string, string> }).config?.urgencyThreshold
        ? parseInt((source as { config?: Record<string, string> }).config!.urgencyThreshold)
        : 3
      const isUrgent = normalized.rating <= urgencyThreshold

      // Insert review
      const [review] = await db
        .insert(reviews)
        .values({
          tenantId,
          sourceId,
          externalId:      normalized.externalId,
          platform,
          locationId:      normalized.locationId ?? source.locationId ?? undefined,
          locationName:    normalized.locationName ?? source.locationName ?? undefined,
          productId:       normalized.productId ?? source.productId ?? undefined,
          productName:     normalized.productName ?? source.productName ?? undefined,
          authorName:      normalized.authorName,
          authorAvatar:    normalized.authorAvatar,
          authorId:        normalized.authorId,
          isVerified:      normalized.isVerified,
          rating:          normalized.rating,
          title:           normalized.title,
          body:            normalized.body,
          reviewedAt:      new Date(normalized.reviewedAt),
          rawPayloadS3Key: s3Key,
          isUrgent,
          status:          "NEW",
          metadata:        normalized.metadata,
        })
        .returning()

      console.log(`Review inserted: ${review.id}`)

      // Enqueue for NLP tagging
      const nlpMessage: NlpTaggingMessage = { tenantId, reviewId: review.id }
      await enqueue("NLP_TAGGING", nlpMessage)

      // Update source last sync
      await db
        .update(reviewSources)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(reviewSources.id, sourceId))
    }),
  )

  const failures = results.filter(r => r.status === "rejected")
  if (failures.length > 0) {
    console.error(`${failures.length} records failed processing`)
    failures.forEach(f => console.error((f as PromiseRejectedResult).reason))
  }
}
