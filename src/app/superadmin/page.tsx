export const dynamic = "force-dynamic"

import { db } from "@/db"
import { tenants, users, subscriptions, reviews, plans } from "@/db/schema"
import { count, eq, sql } from "drizzle-orm"
import { Building2, Users, Star, DollarSign, TrendingUp, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function SuperAdminDashboard() {
  // Pull live stats
  const [
    [{ tenantCount }],
    [{ userCount }],
    [{ reviewCount }],
    recentTenants,
    planBreakdown,
  ] = await Promise.all([
    db.select({ tenantCount: count() }).from(tenants),
    db.select({ userCount: count() }).from(users),
    db.select({ reviewCount: count() }).from(reviews),
    db.select({
      id:        tenants.id,
      name:      tenants.name,
      slug:      tenants.slug,
      plan:      tenants.plan,
      isActive:  tenants.isActive,
      createdAt: tenants.createdAt,
    }).from(tenants).orderBy(sql`${tenants.createdAt} desc`).limit(8),
    db.select({
      plan:  tenants.plan,
      count: count(),
    }).from(tenants).groupBy(tenants.plan),
  ])

  const STAT_CARDS = [
    { title: "Total Tenants",  value: tenantCount,   icon: Building2,   color: "text-blue-400"   },
    { title: "Total Users",    value: userCount,      icon: Users,       color: "text-indigo-400" },
    { title: "Total Reviews",  value: reviewCount,    icon: Star,        color: "text-yellow-400" },
    { title: "Active Plans",   value: planBreakdown.length, icon: TrendingUp, color: "text-green-400" },
  ]

  const PLAN_COLORS: Record<string, string> = {
    FREE:       "bg-slate-700 text-slate-300",
    STARTER:    "bg-blue-900/60 text-blue-300",
    GROWTH:     "bg-indigo-900/60 text-indigo-300",
    ENTERPRISE: "bg-purple-900/60 text-purple-300",
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Platform Overview</h2>
        <p className="text-slate-400 text-sm mt-1">All tenants across the ReviewPulse platform.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ title, value, icon: Icon, color }) => (
          <Card key={title} className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{value.toLocaleString()}</p>
                </div>
                <div className={cn("w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center", color)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm font-medium">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {planBreakdown.map(({ plan, count: c }) => (
                <div key={plan} className="flex items-center justify-between">
                  <Badge className={PLAN_COLORS[plan ?? "FREE"]}>{plan}</Badge>
                  <span className="text-white font-semibold">{c} tenants</span>
                </div>
              ))}
              {planBreakdown.length === 0 && (
                <p className="text-slate-500 text-sm">No tenants yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent tenants */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-sm font-medium">Recent Tenants</CardTitle>
            <a href="/superadmin/tenants" className="text-xs text-indigo-400 hover:underline">View all →</a>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTenants.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.slug}.reviewpulse.io</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={PLAN_COLORS[t.plan ?? "FREE"]}>{t.plan ?? "FREE"}</Badge>
                    <Badge variant={t.isActive ? "default" : "destructive"} className="text-xs">
                      {t.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
              {recentTenants.length === 0 && (
                <p className="text-slate-500 text-sm">No tenants yet. <a href="/onboard" className="text-indigo-400 hover:underline">Onboard the first one →</a></p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// cn helper import
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ")
}
