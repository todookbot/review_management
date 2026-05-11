import { NextResponse } from "next/server"
import { db }    from "@/db"
import { tenants } from "@/db/schema"
import { desc }  from "drizzle-orm"

export async function GET() {
  const rows = await db
    .select({
      id: tenants.id, name: tenants.name, slug: tenants.slug,
      plan: tenants.plan, isActive: tenants.isActive,
      brandName: tenants.brandName, customDomain: tenants.customDomain,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))

  return NextResponse.json({ tenants: rows })
}
