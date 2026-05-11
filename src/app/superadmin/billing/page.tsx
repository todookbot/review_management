import { db } from "@/db"
import { invoices, tenants, subscriptions, plans } from "@/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { Badge }  from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react"

export default async function BillingPage() {
  const allInvoices = await db
    .select({
      id:            invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status:        invoices.status,
      total:         invoices.total,
      currency:      invoices.currency,
      periodStart:   invoices.periodStart,
      periodEnd:     invoices.periodEnd,
      paidAt:        invoices.paidAt,
      tenantName:    tenants.name,
      tenantSlug:    tenants.slug,
    })
    .from(invoices)
    .leftJoin(tenants, eq(invoices.tenantId, tenants.id))
    .orderBy(desc(invoices.createdAt))
    .limit(50)

  const STATUS_COLORS: Record<string, string> = {
    PAID:          "bg-green-900/60 text-green-300",
    OPEN:          "bg-yellow-900/60 text-yellow-300",
    DRAFT:         "bg-slate-700 text-slate-300",
    VOID:          "bg-slate-700 text-slate-400",
    UNCOLLECTIBLE: "bg-red-900/60 text-red-300",
  }

  const totalRevenue = allInvoices
    .filter(i => i.status === "PAID")
    .reduce((sum, i) => sum + parseFloat(i.total ?? "0"), 0)

  const openAmount = allInvoices
    .filter(i => i.status === "OPEN")
    .reduce((sum, i) => sum + parseFloat(i.total ?? "0"), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Billing & Invoices</h2>
        <p className="text-slate-400 text-sm mt-1">Revenue overview across all tenants.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-600/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Total Revenue</p>
              <p className="text-white font-bold text-xl">${totalRevenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-600/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Open / Unpaid</p>
              <p className="text-white font-bold text-xl">${openAmount.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Total Invoices</p>
              <p className="text-white font-bold text-xl">{allInvoices.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {["Invoice #", "Tenant", "Period", "Amount", "Status", "Paid At"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allInvoices.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">No invoices yet.</td></tr>
            ) : allInvoices.map(inv => (
              <tr key={inv.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-indigo-400 font-mono text-xs">{inv.invoiceNumber}</td>
                <td className="px-4 py-3">
                  <p className="text-white">{inv.tenantName}</p>
                  <p className="text-slate-500 text-xs">{inv.tenantSlug}.reviewpulse.io</p>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-white font-semibold">
                  ${parseFloat(inv.total ?? "0").toFixed(2)} <span className="text-slate-500 font-normal text-xs">{inv.currency}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge className={STATUS_COLORS[inv.status ?? "DRAFT"]}>{inv.status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
