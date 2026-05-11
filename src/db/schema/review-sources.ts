import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"

export const platformEnum = pgEnum("platform", [
  // Physical / Location
  "GOOGLE_MY_BUSINESS",
  "YELP",
  "TRIPADVISOR",
  "FACEBOOK",
  "FOURSQUARE",
  "APPLE_MAPS",
  "ZOMATO",
  "JUSTDIAL",
  // Product
  "AMAZON",
  "FLIPKART",
  "SHOPIFY",
  "WOOCOMMERCE",
  "TRUSTPILOT",
  "G2",
  "CAPTERRA",
  "PRODUCTHUNT",
  // App Stores
  "APPLE_APP_STORE",
  "GOOGLE_PLAY_STORE",
  "HUAWEI_APPGALLERY",
  // Social
  "TWITTER",
  "INSTAGRAM",
  "REDDIT",
  "LINKEDIN",
  // Hospitality
  "BOOKING_COM",
  "AIRBNB",
  "EXPEDIA",
  "AGODA",
  // Internal
  "QR_FEEDBACK",
  "EMAIL_SURVEY",
  "INAPP_SDK",
  "CUSTOM_API",
])

export const authModeEnum = pgEnum("auth_mode", [
  "API_KEY",   // User provides their own API key
  "OAUTH",     // OAuth flow — we fetch & store tokens
  "WEBHOOK",   // Platform pushes events to our endpoint
  "NONE",      // Internal sources (QR forms, email surveys)
])

export const sourceStatusEnum = pgEnum("source_status", [
  "ACTIVE",
  "PAUSED",
  "ERROR",
  "PENDING_AUTH",
])

export const reviewSources = pgTable("review_sources", {
  id:               uuid("id").primaryKey().defaultRandom(),
  tenantId:         uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  platform:         platformEnum("platform").notNull(),
  authMode:         authModeEnum("auth_mode").notNull(),
  displayName:      varchar("display_name", { length: 255 }).notNull(), // e.g. "NYC Store - Google"

  // Location or product scoping
  locationId:       varchar("location_id", { length: 255 }),  // Google place_id, Yelp business_id etc.
  locationName:     varchar("location_name", { length: 255 }),
  productId:        varchar("product_id", { length: 255 }),
  productName:      varchar("product_name", { length: 255 }),

  // AWS Secrets Manager ARN — holds API key, OAuth tokens, etc.
  secretArn:        text("secret_arn"),

  // Webhook fields
  webhookSecret:    text("webhook_secret"),    // HMAC signing secret
  webhookUrl:       text("webhook_url"),       // Generated: /api/webhooks/[tenantId]/[sourceId]

  // OAuth metadata
  oauthScopes:      text("oauth_scopes").array(),
  tokenExpiresAt:   timestamp("token_expires_at"),
  externalAccountId: varchar("external_account_id", { length: 255 }), // e.g. Google account email

  status:           sourceStatusEnum("status").default("PENDING_AUTH"),
  isActive:         boolean("is_active").default(true),

  // Sync config
  syncIntervalMinutes: varchar("sync_interval_minutes", { length: 10 }).default("60"),
  lastSyncAt:       timestamp("last_sync_at"),
  lastSyncError:    text("last_sync_error"),

  // Extra platform-specific config
  config:           jsonb("config").$type<Record<string, string>>().default({}),

  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
})

export type ReviewSource    = typeof reviewSources.$inferSelect
export type NewReviewSource = typeof reviewSources.$inferInsert
