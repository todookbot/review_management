import { pgTable, uuid, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core"
import { reviews } from "./reviews"
import { tenants } from "./tenants"
import { users } from "./users"

export const draftStatusEnum = pgEnum("draft_status", [
  "DRAFT",             // AI generated, not yet reviewed
  "PENDING_APPROVAL",  // Submitted for human review
  "APPROVED",          // Approved — ready to publish
  "REJECTED",          // Rejected — needs revision
  "PUBLISHED",         // Posted back to the review platform
  "FAILED",            // Publishing failed
])

export const aiProviderEnum = pgEnum("ai_provider", [
  "CLAUDE",
  "OPENAI",
  "HUMAN",   // manually written
])

export const responseDrafts = pgTable("response_drafts", {
  id:              uuid("id").primaryKey().defaultRandom(),
  reviewId:        uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Draft content
  body:            text("body").notNull(),
  bodyEditedBy:    uuid("body_edited_by").references(() => users.id),  // if human edited
  bodyEditedAt:    timestamp("body_edited_at"),

  // AI generation metadata
  aiProvider:      aiProviderEnum("ai_provider").notNull(),
  model:           varchar("model", { length: 100 }),         // e.g. claude-3-5-sonnet, gpt-4o
  promptVersion:   varchar("prompt_version", { length: 20 }), // for A/B tracking

  // Workflow
  status:          draftStatusEnum("draft_status").default("DRAFT"),
  createdBy:       uuid("created_by").references(() => users.id), // null = AI auto-generated
  submittedBy:     uuid("submitted_by").references(() => users.id),
  submittedAt:     timestamp("submitted_at"),
  approvedBy:      uuid("approved_by").references(() => users.id),
  approvedAt:      timestamp("approved_at"),
  rejectedBy:      uuid("rejected_by").references(() => users.id),
  rejectedAt:      timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),

  // Publishing
  publishedAt:     timestamp("published_at"),
  publishError:    text("publish_error"),

  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
})

export type ResponseDraft    = typeof responseDrafts.$inferSelect
export type NewResponseDraft = typeof responseDrafts.$inferInsert
