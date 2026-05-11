import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"

export const userRoleEnum = pgEnum("user_role", [
  "SUPER_ADMIN",    // Platform owner
  "TENANT_ADMIN",   // Brand/company admin
  "MANAGER",        // Location / product manager
  "RESPONDER",      // Can draft & approve responses
  "VIEWER",         // Read-only analytics
])

export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  email:        varchar("email", { length: 255 }).notNull().unique(),
  name:         varchar("name", { length: 255 }).notNull(),
  avatarUrl:    text("avatar_url"),
  role:         userRoleEnum("role").default("VIEWER"),
  passwordHash: text("password_hash"),
  isActive:     boolean("is_active").default(true),
  // Location/product scope — null means access to all
  scopedLocationIds: text("scoped_location_ids").array(),
  lastLoginAt:  timestamp("last_login_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
})

export type User    = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
