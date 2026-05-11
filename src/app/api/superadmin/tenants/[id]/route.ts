import { NextRequest, NextResponse } from "next/server"
import { db }      from "@/db"
import { tenants, users, subscriptions, reviewSources } from "@/db/schema"
import { eq, count } from "drizzle-orm"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [[{ userCount }], [{ sourceCount }], sub] = await Promise.all([
    db.select({ userCount: count() }).from(users).where(eq(users.tenantId, id)),
    db.select({ sourceCount: count() }).from(reviewSources).where(eq(reviewSources.tenantId, id)),
    db.select().from(subscriptions).where(eq(subscriptions.tenantId, id)).limit(1),
  ])

  return NextResponse.json({ tenant, userCount, sourceCount, subscription: sub[0] ?? null })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const allowed = ["isActive", "plan", "brandName", "primaryColor", "customDomain", "logoUrl"]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  update.updatedAt = new Date()

  await db.update(tenants).set(update).where(eq(tenants.id, id))
  return NextResponse.json({ success: true })
}
