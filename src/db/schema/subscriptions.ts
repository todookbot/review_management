import { pgTable, uuid, varchar, boolean, timestamp, pgEnum, integer, numeric } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
import { plans }   from "./plans"

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "PAUSED",
])

export const billingCycleEnum = pgEnum("billing_cycle", ["MONTHLY", "YEARLY"])

export const subscriptions = pgTable("subscriptions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planId:          uuid("plan_id").notNull().references(() => plans.id),
  status:          subscriptionStatusEnum("status").default("TRIALING"),
  billingCycle:    billingCycleEnum("billing_cycle").default("MONTHLY"),
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd:   timestamp("current_period_end").notNull(),
  trialEndsAt:     timestamp("trial_ends_at"),
  canceledAt:      timestamp("canceled_at"),
  // Usage tracking (reset each billing period)
  reviewsThisPeriod:     integer("reviews_this_period").default(0),
  storageUsedGb:         numeric("storage_used_gb", { precision: 10, scale: 4 }).default("0"),
  connectorsActive:      integer("connectors_active").default(0),
  // Stripe/payment references (can be wired up later)
  externalSubscriptionId: varchar("external_subscription_id", { length: 255 }),
  externalCustomerId:     varchar("external_customer_id", { length: 255 }),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
})

export type Subscription    = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
