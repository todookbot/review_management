"use client"

import { useEffect, useState, useTransition } from "react"
import { Plus, Edit, Trash2, Check, X } from "lucide-react"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import { Label }   from "@/components/ui/label"
import { Switch }  from "@/components/ui/switch"
import { Badge }   from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast }   from "sonner"

type Plan = {
  id: string; name: string; slug: string; description: string | null
  maxConnectors: number; maxReviewsPerMonth: number; maxStorageGb: string
  maxUsers: number; priceMonthly: string; priceYearly: string
  isActive: boolean; isPublic: boolean; sortOrder: number
  features: Record<string, boolean>
}

const FEATURE_LABELS: Record<string, string> = {
  aiDrafts:          "AI Response Drafts",
  nlpTagging:        "NLP Tagging",
  whiteLabel:        "White-label UI",
  customDomain:      "Custom Domain",
  apiAccess:         "API Access",
  prioritySupport:   "Priority Support",
  advancedAnalytics: "Advanced Analytics",
  teamCollaboration: "Team Collaboration",
}

const EMPTY_PLAN = {
  name: "", slug: "", description: "",
  maxConnectors: 5, maxReviewsPerMonth: 1000, maxStorageGb: "5",
  maxUsers: 3, priceMonthly: "0", priceYearly: "0",
  isActive: true, isPublic: true, sortOrder: 0,
  features: Object.fromEntries(Object.keys(FEATURE_LABELS).map(k => [k, false])),
}

export default function PlansPage() {
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [dialog,  setDialog]  = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form,    setForm]    = useState<typeof EMPTY_PLAN>({ ...EMPTY_PLAN })
  const [pending, start]      = useTransition()

  useEffect(() => {
    fetch("/api/superadmin/plans").then(r => r.json()).then(d => setPlans(d.plans ?? []))
  }, [])

  function openCreate() { setEditing(null); setForm({ ...EMPTY_PLAN }); setDialog(true) }
  function openEdit(p: Plan) {
    setEditing(p)
    setForm({
      name: p.name, slug: p.slug, description: p.description ?? "",
      maxConnectors: p.maxConnectors, maxReviewsPerMonth: p.maxReviewsPerMonth,
      maxStorageGb: p.maxStorageGb, maxUsers: p.maxUsers,
      priceMonthly: p.priceMonthly, priceYearly: p.priceYearly,
      isActive: p.isActive, isPublic: p.isPublic, sortOrder: p.sortOrder,
      features: { ...EMPTY_PLAN.features, ...(p.features ?? {}) },
    })
    setDialog(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const url    = editing ? `/api/superadmin/plans/${editing.id}` : "/api/superadmin/plans"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return }
      toast.success(editing ? "Plan updated" : "Plan created")
      setDialog(false)
      fetch("/api/superadmin/plans").then(r => r.json()).then(d => setPlans(d.plans ?? []))
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Plans</h2>
          <p className="text-slate-400 text-sm mt-1">Define connector limits, storage quotas, and feature gates per plan.</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div key={plan.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
                <p className="text-slate-500 text-xs mt-0.5">{plan.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={plan.isActive ? "default" : "secondary"} className="text-xs">
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}
                  className="w-7 h-7 text-slate-400 hover:text-white">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Pricing */}
            <div className="flex gap-4">
              <div>
                <p className="text-slate-500 text-xs">Monthly</p>
                <p className="text-white font-bold text-xl">${plan.priceMonthly}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Yearly</p>
                <p className="text-white font-bold text-xl">${plan.priceYearly}</p>
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Connectors", plan.maxConnectors],
                ["Reviews/mo", plan.maxReviewsPerMonth.toLocaleString()],
                ["Storage", `${plan.maxStorageGb} GB`],
                ["Users", plan.maxUsers],
              ].map(([label, val]) => (
                <div key={label as string} className="bg-slate-800 rounded-lg p-2.5">
                  <p className="text-slate-500">{label}</p>
                  <p className="text-white font-semibold mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="space-y-1">
              {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {plan.features?.[key]
                    ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    : <X    className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  }
                  <span className={plan.features?.[key] ? "text-slate-300" : "text-slate-600"}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-500">
            No plans yet. Create your first plan.
          </div>
        )}
      </div>

      {/* Edit / Create dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Plan Name</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Growth" required className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Slug (unique ID)</Label>
                <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="growth" required className="bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Description</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="For growing businesses" className="bg-slate-800 border-slate-600 text-white" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Monthly Price ($)", key: "priceMonthly" },
                { label: "Yearly Price ($)",  key: "priceYearly"  },
                { label: "Max Connectors",    key: "maxConnectors",      isNum: true },
                { label: "Max Reviews / mo",  key: "maxReviewsPerMonth", isNum: true },
                { label: "Storage (GB)",      key: "maxStorageGb"        },
                { label: "Max Users",         key: "maxUsers",           isNum: true },
              ].map(({ label, key, isNum }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-slate-300">{label}</Label>
                  <Input
                    type={isNum ? "number" : "text"}
                    value={form[key as keyof typeof form] as string | number}
                    onChange={e => setForm(p => ({
                      ...p,
                      [key]: isNum ? parseInt(e.target.value) : e.target.value
                    }))}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              ))}
            </div>

            {/* Feature toggles */}
            <div>
              <Label className="text-slate-300 mb-3 block">Feature Gates</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-slate-300">{label}</span>
                    <Switch
                      checked={!!form.features[key]}
                      onCheckedChange={v => setForm(p => ({ ...p, features: { ...p.features, [key]: v } }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
                <Label className="text-slate-300">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isPublic} onCheckedChange={v => setForm(p => ({ ...p, isPublic: v }))} />
                <Label className="text-slate-300">Show on pricing page</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {editing ? "Update Plan" : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
