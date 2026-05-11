import { pgTable, uuid, varchar, real, timestamp, pgEnum } from "drizzle-orm/pg-core"
import { reviews } from "./reviews"

export const tagTypeEnum = pgEnum("tag_type", [
  // Sentiment
  "SENTIMENT",          // POSITIVE | NEGATIVE | NEUTRAL | MIXED
  // Topics (what the review is about)
  "TOPIC",              // food, service, ambiance, price, cleanliness, staff, etc.
  // Named entities
  "ENTITY_PERSON",      // staff name mentioned
  "ENTITY_PRODUCT",     // specific product mentioned
  "ENTITY_LOCATION",    // location mentioned
  // Operational signals
  "URGENCY",            // LOW | MEDIUM | HIGH | CRITICAL
  "INTENT",             // COMPLAINT | PRAISE | SUGGESTION | QUESTION
  "LANGUAGE",           // detected language
])

export const tagSourceEnum = pgEnum("tag_source", [
  "AWS_COMPREHEND",   // AWS Comprehend NLP
  "CLAUDE",           // Claude AI tagging
  "OPENAI",           // OpenAI tagging
  "MANUAL",           // Human-added tag
])

export const reviewTags = pgTable("review_tags", {
  id:        uuid("id").primaryKey().defaultRandom(),
  reviewId:  uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
  tagType:   tagTypeEnum("tag_type").notNull(),
  value:     varchar("value", { length: 255 }).notNull(),   // e.g. "POSITIVE", "food", "HIGH"
  score:     real("score"),                                  // confidence 0.0–1.0
  source:    tagSourceEnum("tag_source").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type ReviewTag    = typeof reviewTags.$inferSelect
export type NewReviewTag = typeof reviewTags.$inferInsert
