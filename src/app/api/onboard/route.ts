import { NextRequest, NextResponse } from "next/server"
import { db }    from "@/db"
import { tenants, users, plans, subscriptions } from "@/db/schema"
import { eq }    from "drizzle-orm"
import bcrypt    from "bcryptjs"
import { z }     from "zod"

const schema = z.object({
  companyName:  z.string().min(2).max(255),
  subdomain:    z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  adminName:    z.string().min(2).max(255),
  adminEmail:   z.string().email(),
  password:     z.string().min(8),
  planSlug:     z.string().default("starter"),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { companyName, subdomain, adminName, adminEmail, password, planSlug } = parsed.data

    // Check slug uniqueness
    const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, subdomain)).limit(1)
    if (existing.length > 0) {
      return NextResponse.json({ error: "That subdomain is already taken." }, { status: 409 })
    }

    // Check email uniqueness
    const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail.toLowerCase())).limit(1)
    if (existingUser.length > 0) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
    }

    // Resolve plan
    const [plan] = await db.select().from(plans).where(eq(plans.slug, planSlug)).limit(1)

    // Create tenant
    const [tenant] = await db.insert(tenants).values({
      name:      companyName,
      slug:      subdomain,
      brandName: companyName,
      plan:      planSlug.toUpperCase() as "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE",
      isActive:  true,
    }).returning()

    // Create admin user
    const passwordHash = await bcrypt.hash(password, 12)
    await db.insert(users).values({
      tenantId:     tenant.id,
      email:        adminEmail.toLowerCase(),
      name:         adminName,
      role:         "TENANT_ADMIN",
      passwordHash,
      isActive:     true,
    })

    // Create subscription (14-day trial)
    if (plan) {
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 14)
      await db.insert(subscriptions).values({
        tenantId:           tenant.id,
        planId:             plan.id,
        status:             "TRIALING",
        billingCycle:       "MONTHLY",
        currentPeriodStart: new Date(),
        currentPeriodEnd:   trialEnd,
        trialEndsAt:        trialEnd,
      })
    }

    return NextResponse.json({ success: true, tenantSlug: subdomain })
  } catch (err) {
    console.error("Onboard error:", err)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
