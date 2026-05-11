import { pgTable, uuid, varchar, numeric, timestamp, pgEnum, text, jsonb } from "drizzle-orm/pg-core"
import { tenants }       from "./tenants"
import { subscriptions } from "./subscriptions"

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "DRAFT",
  "OPEN",
  "PAID",
  "VOID",
  "UNCOLLECTIBLE",
])

export const invoices = pgTable("invoices", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  invoiceNumber:  varchar("invoice_number", { length: 50 }).notNull().unique(),
  status:         invoiceStatusEnum("status").default("DRAFT"),
  // Amounts
  subtotal:       numeric("subtotal",    { precision: 10, scale: 2 }).notNull(),
  tax:            numeric("tax",         { precision: 10, scale: 2 }).default("0"),
  discount:       numeric("discount",    { precision: 10, scale: 2 }).default("0"),
  total:          numeric("total",       { precision: 10, scale: 2 }).notNull(),
  currency:       varchar("currency", { length: 3 }).default("USD"),
  // Period
  periodStart:    timestamp("period_start").notNull(),
  periodEnd:      timestamp("period_end").notNull(),
  dueDate:        timestamp("due_date"),
  paidAt:         timestamp("paid_at"),
  // Line items
  lineItems: jsonb("line_items").$type<Array<{
    description: string
    quantity:    number
    unitPrice:   number
    total:       number
  }>>().default([]),
  // External
  externalInvoiceId: varchar("external_invoice_id", { length: 255 }),
  invoicePdfUrl:     text("invoice_pdf_url"),
  notes:             text("notes"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
})

export type Invoice    = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
