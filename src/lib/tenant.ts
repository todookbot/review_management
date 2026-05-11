import { db } from "@/db"
import { tenants } from "@/db/schema"
import { eq, or } from "drizzle-orm"
import type { Tenant } from "@/db/schema"

/**
 * Resolve tenant from request hostname.
 * Supports:
 *   - subdomain.reviewpulse.io  → slug lookup
 *   - custom-domain.com         → customDomain lookup
 */
export async function resolveTenant(hostname: string): Promise<Tenant | null> {
  const appRoot = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
    : "localhost"

  let slug: string | null = null
  let customDomain: string | null = null

  if (hostname === appRoot || hostname === "localhost") {
    // Platform root — no tenant context
    return null
  }

  if (hostname.endsWith(`.${appRoot}`)) {
    // Subdomain: <slug>.reviewpulse.io
    slug = hostname.replace(`.${appRoot}`, "")
  } else {
    // Fully custom domain
    customDomain = hostname
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(
      slug
        ? eq(tenants.slug, slug)
        : eq(tenants.customDomain!, customDomain!),
    )
    .limit(1)

  return tenant ?? null
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1)
  return tenant ?? null
}
