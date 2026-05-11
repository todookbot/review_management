import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core"

export const planEnum = pgEnum("plan", ["FREE", "STARTER", "GROWTH", "ENTERPRISE"])

export const tenants = pgTable("tenants", {
  id:              uuid("id").primaryKey().defaultRandom(),
  name:            varchar("name", { length: 255 }).notNull(),
  slug:            varchar("slug", { length: 100 }).notNull().unique(), // subdomain
  customDomain:    varchar("custom_domain", { length: 255 }),           // white-label domain
  logoUrl:         text("logo_url"),
  faviconUrl:      text("favicon_url"),
  primaryColor:    varchar("primary_color", { length: 7 }).default("#6366f1"),
  secondaryColor:  varchar("secondary_color", { length: 7 }).default("#f1f5f9"),
  brandName:       varchar("brand_name", { length: 255 }),              // overrides app name in UI
  plan:            planEnum("plan").default("FREE"),
  isActive:        boolean("is_active").default(true),
  settings:        jsonb("settings").$type<{
    autoTagging:       boolean
    autoDraft:         boolean
    defaultAiProvider: "CLAUDE" | "OPENAI"
    responseLanguage:  string
    notifyOnNewReview: boolean
    notifyOnNegative:  boolean
    urgencyThreshold:  number  // star rating below which = urgent
  }>().default({
    autoTagging:       true,
    autoDraft:         true,
    defaultAiProvider: "CLAUDE",
    responseLanguage:  "en",
    notifyOnNewReview: true,
    notifyOnNegative:  true,
    urgencyThreshold:  3,
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Tenant    = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
