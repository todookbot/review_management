/**
 * Lambda: AI Draft Generator
 * Trigger: SQS ai-draft-queue
 *
 * 1. Generates AI response draft (Claude or OpenAI)
 * 2. Saves draft to DB
 * 3. Sends SES email to approvers
 */

import { generateResponseDraft } from "@/lib/ai/draft-generator"
import { sendDraftPendingApproval } from "@/lib/aws/ses"
import { db } from "@/db"
import { reviews, responseDrafts, users } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import type { Handler, SQSEvent } from "aws-lambda"
import type { AiDraftMessage } from "@/lib/aws/sqs"

export const handler: Handler<SQSEvent> = async (event) => {
  await Promise.allSettled(
    event.Records.map(async (record) => {
      const message: AiDraftMessage = JSON.parse(record.body)
      const { tenantId, reviewId, aiProvider } = message

      console.log(`Generating AI draft for review: ${reviewId} using ${aiProvider}`)

      const draftId = await generateResponseDraft(reviewId, tenantId, aiProvider)

      // Load draft + review for email notification
      const [draft]  = await db.select().from(responseDrafts).where(eq(responseDrafts.id, draftId)).limit(1)
      const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1)

      // Get TENANT_ADMIN + MANAGER emails to notify
      const approvers = await db
        .select({ email: users.email })
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.isActive, true),
        ))

      const approverEmails = approvers.map(u => u.email)

      if (approverEmails.length > 0 && review && draft) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
        await sendDraftPendingApproval({
          to:          approverEmails,
          tenantName:  "Your Brand",
          reviewBody:  review.body ?? "",
          draftBody:   draft.body,
          approveUrl:  `${appUrl}/api/drafts/${draftId}/approve`,
          rejectUrl:   `${appUrl}/api/drafts/${draftId}/reject`,
        })
        console.log(`Notified ${approverEmails.length} approvers for draft: ${draftId}`)
      }
    }),
  )
}
