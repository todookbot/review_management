import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core"

export const plans = pgTable("plans", {
  id:               uuid("id").primaryKey().defaultRandom(),
  name:             varchar("name", { length: 100 }).notNull().unique(), // "Starter", "Growth", etc.
  slug:             varchar("slug", { length: 50 }).notNull().unique(),  // "starter", "growth"
  description:      text("description"),
  // Connector & data limits
  maxConnectors:    integer("max_connectors").notNull().default(5),
  maxReviewsPerMonth: integer("max_reviews_per_month").notNull().default(1000),
  maxStorageGb:     numeric("max_storage_gb", { precision: 6, scale: 2 }).notNull().default("5"),
  maxUsers:         integer("max_users").notNull().default(3),
  maxLocations:     integer("max_locations").notNull().default(1),
  // Pricing
  priceMonthly:     numeric("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
  priceYearly:      numeric("price_yearly",  { precision: 10, scale: 2 }).notNull().default("0"),
  currency:         varchar("currency", { length: 3 }).default("USD"),
  // Feature gates
  features: jsonb("features").$type<{
    aiDrafts:          boolean
    nlpTagging:        boolean
    whiteLabel:        boolean
    customDomain:      boolean
    apiAccess:         boolean
    prioritySupport:   boolean
    advancedAnalytics: boolean
    teamCollaboration: boolean
  }>().default({
    aiDrafts:          false,
    nlpTagging:        false,
    whiteLabel:        false,
    customDomain:      false,
    apiAccess:         false,
    prioritySupport:   false,
    advancedAnalytics: false,
    teamCollaboration: false,
  }),
  isActive:   boolean("is_active").default(true),
  isPublic:   boolean("is_public").default(true),  // visible on pricing page
  sortOrder:  integer("sort_order").default(0),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
})

export type Plan    = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
