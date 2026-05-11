import { pgTable, uuid, varchar, text, integer, real, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
import { reviewSources } from "./review-sources"

export const reviewStatusEnum = pgEnum("review_status", [
  "NEW",
  "IN_PROGRESS",
  "DRAFT_CREATED",
  "RESPONDED",
  "IGNORED",
])

export const reviews = pgTable("reviews", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sourceId:       uuid("source_id").notNull().references(() => reviewSources.id),

  // External platform identity
  externalId:     varchar("external_id", { length: 512 }).notNull(), // platform's review ID
  platform:       varchar("platform", { length: 50 }).notNull(),     // denormalized for fast query

  // Location / Product context
  locationId:     varchar("location_id", { length: 255 }),
  locationName:   varchar("location_name", { length: 255 }),
  productId:      varchar("product_id", { length: 255 }),
  productName:    varchar("product_name", { length: 255 }),

  // Reviewer info
  authorName:     varchar("author_name", { length: 255 }),
  authorAvatar:   text("author_avatar"),
  authorId:       varchar("author_id", { length: 255 }),  // platform user id
  isVerified:     boolean("is_verified").default(false),

  // Review content
  rating:         real("rating"),         // 1.0 – 5.0
  title:          text("title"),
  body:           text("body"),
  language:       varchar("language", { length: 10 }).default("en"),  // ISO 639-1
  reviewedAt:     timestamp("reviewed_at"),  // when the review was written on the platform

  // S3 reference for raw payload
  rawPayloadS3Key: text("raw_payload_s3_key"),

  // Processing state
  status:         reviewStatusEnum("status").default("NEW"),
  isUrgent:       boolean("is_urgent").default(false),   // rating below threshold
  isProcessed:    boolean("is_processed").default(false), // NLP done

  // Platform-specific metadata
  metadata:       jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
})

export type Review    = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
