"use client"

import { useEffect, useState, useTransition } from "react"
import { Building2, Plus, Search, MoreVertical, ExternalLink, Ban, CheckCircle, Edit } from "lucide-react"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import { Badge }   from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label }   from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast }   from "sonner"
import Link        from "next/link"

type Tenant = {
  id: string; name: string; slug: string; plan: string; isActive: boolean
  createdAt: string; brandName: string | null; customDomain: string | null
}

const PLAN_COLORS: Record<string, string> = {
  FREE:       "bg-slate-700 text-slate-300",
  STARTER:    "bg-blue-900/60 text-blue-300",
  GROWTH:     "bg-indigo-900/60 text-indigo-300",
  ENTERPRISE: "bg-purple-900/60 text-purple-300",
}

export default function TenantsPage() {
  const [tenants,  setTenants]  = useState<Tenant[]>([])
  const [search,   setSearch]   = useState("")
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [pending, start]        = useTransition()

  const [form, setForm] = useState({
    name: "", slug: "", adminName: "", adminEmail: "", password: "", plan: "STARTER",
  })

  useEffect(() => {
    fetch("/api/superadmin/tenants")
      .then(r => r.json())
      .then(d => { setTenants(d.tenants ?? []); setLoading(false) })
  }, [])

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.name, subdomain: form.slug,
          adminName: form.adminName, adminEmail: form.adminEmail,
          password: form.password, planSlug: form.plan.toLowerCase(),
        }),
      })
      if (!res.ok) {
        const d = await res.json(); toast.error(d.error); return
      }
      toast.success(`Tenant "${form.name}" created!`)
      setCreating(false)
      fetch("/api/superadmin/tenants").then(r => r.json()).then(d => setTenants(d.tenants ?? []))
    })
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/superadmin/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    })
    setTenants(prev => prev.map(t => t.id === id ? { ...t, isActive: !current } : t))
    toast.success(current ? "Tenant deactivated" : "Tenant activated")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Tenants</h2>
          <p className="text-slate-400 text-sm mt-1">{tenants.length} total tenants on the platform.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
          <Plus className="w-4 h-4" /> New Tenant
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search by name or subdomain…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-900 border-slate-700 text-white pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {["Tenant", "Subdomain", "Plan", "Status", "Created", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">No tenants found.</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{t.name}</p>
                      {t.brandName && t.brandName !== t.name && (
                        <p className="text-slate-500 text-xs">{t.brandName}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-300">{t.slug}.reviewpulse.io</span>
                  {t.customDomain && <p className="text-slate-500 text-xs">{t.customDomain}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge className={PLAN_COLORS[t.plan ?? "FREE"]}>{t.plan ?? "FREE"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={t.isActive ? "default" : "destructive"} className="text-xs">
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                      <DropdownMenuItem asChild className="text-slate-300 focus:bg-slate-700">
                        <Link href={`/superadmin/tenants/${t.id}`}>
                          <Edit className="w-4 h-4 mr-2" /> Manage
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toggleActive(t.id, t.isActive)}
                        className="text-slate-300 focus:bg-slate-700"
                      >
                        {t.isActive
                          ? <><Ban className="w-4 h-4 mr-2 text-red-400" /> Deactivate</>
                          : <><CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Activate</>}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Onboard New Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            {[
              { label: "Company Name", key: "name",       type: "text",     placeholder: "Acme Corp"        },
              { label: "Subdomain",    key: "slug",       type: "text",     placeholder: "acme"              },
              { label: "Admin Name",   key: "adminName",  type: "text",     placeholder: "Jane Doe"          },
              { label: "Admin Email",  key: "adminEmail", type: "email",    placeholder: "jane@acme.com"     },
              { label: "Password",     key: "password",   type: "password", placeholder: "Min 8 characters"  },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-slate-300">{label}</Label>
                <Input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  required
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-slate-300">Plan</Label>
              <Select value={form.plan} onValueChange={v => setForm(p => ({ ...p, plan: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {["FREE","STARTER","GROWTH","ENTERPRISE"].map(p => (
                    <SelectItem key={p} value={p} className="text-white focus:bg-slate-700">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending} className="bg-indigo-600 hover:bg-indigo-500 text-white w-full">
                Create Tenant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
