import { NextRequest, NextResponse } from "next/server"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
}

export function proxy(req: NextRequest) {
  const hostname = req.headers.get("host") ?? ""
  const url      = req.nextUrl.clone()

  const appRoot = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
    : "localhost"

  // Strip port for local dev
  const cleanHost = hostname.split(":")[0]

  // Determine tenant slug from subdomain
  let tenantSlug: string | null = null
  if (cleanHost !== appRoot && cleanHost !== "localhost" && cleanHost !== "127.0.0.1") {
    if (cleanHost.endsWith(`.${appRoot}`)) {
      tenantSlug = cleanHost.replace(`.${appRoot}`, "")
    } else {
      // Custom domain — pass as header for server components to resolve
      const res = NextResponse.next()
      res.headers.set("x-tenant-domain", cleanHost)
      return res
    }
  }

  if (tenantSlug) {
    // Rewrite to /[tenant] internally but keep URL clean
    url.pathname = `/${tenantSlug}${url.pathname}`
    const res = NextResponse.rewrite(url)
    res.headers.set("x-tenant-slug", tenantSlug)
    return res
  }

  // Pass tenant-slug header downstream for API routes
  const res = NextResponse.next()
  if (tenantSlug) res.headers.set("x-tenant-slug", tenantSlug as string)
  return res
}
