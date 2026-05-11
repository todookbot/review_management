import { NextRequest, NextResponse } from "next/server"
import { db }   from "@/db"
import { plans } from "@/db/schema"
import { asc }  from "drizzle-orm"

export async function GET() {
  const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder))
  return NextResponse.json({ plans: rows })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const [created] = await db.insert(plans).values({
    name:               body.name,
    slug:               body.slug,
    description:        body.description,
    maxConnectors:      body.maxConnectors,
    maxReviewsPerMonth: body.maxReviewsPerMonth,
    maxStorageGb:       body.maxStorageGb,
    maxUsers:           body.maxUsers,
    priceMonthly:       body.priceMonthly,
    priceYearly:        body.priceYearly,
    isActive:           body.isActive,
    isPublic:           body.isPublic,
    sortOrder:          body.sortOrder,
    features:           body.features,
  }).returning()
  return NextResponse.json({ plan: created })
}
