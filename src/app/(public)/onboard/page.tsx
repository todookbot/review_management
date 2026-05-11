"use client"

import { useState, useTransition } from "react"
import { useRouter }    from "next/navigation"
import { Star, Check, Loader2, Building2, User, Lock, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Badge }  from "@/components/ui/badge"
import { cn }     from "@/lib/utils"

const PLANS = [
  {
    id:    "free",
    name:  "Free",
    price: 0,
    connectors: 2,
    reviews: "500 / mo",
    users: 1,
    features: ["2 connectors", "500 reviews/mo", "Basic NLP tagging", "1 user"],
    highlight: false,
  },
  {
    id:    "starter",
    name:  "Starter",
    price: 49,
    connectors: 5,
    reviews: "5,000 / mo",
    users: 5,
    features: ["5 connectors", "5,000 reviews/mo", "AI drafts", "NLP tagging", "5 users"],
    highlight: false,
  },
  {
    id:    "growth",
    name:  "Growth",
    price: 149,
    connectors: 15,
    reviews: "25,000 / mo",
    users: 20,
    features: ["15 connectors", "25,000 reviews/mo", "AI drafts", "Advanced analytics", "White-label", "20 users"],
    highlight: true,
  },
  {
    id:    "enterprise",
    name:  "Enterprise",
    price: null,
    connectors: 999,
    reviews: "Unlimited",
    users: 999,
    features: ["Unlimited connectors", "Unlimited reviews", "Custom domain", "Priority support", "SLA", "API access"],
    highlight: false,
  },
]

type Step = 1 | 2 | 3

export default function OnboardPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [selectedPlan, setSelectedPlan] = useState("starter")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    companyName: "",
    subdomain:   "",
    adminName:   "",
    adminEmail:  "",
    password:    "",
    confirmPw:   "",
  })

  function update(k: keyof typeof form, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    // Auto-generate subdomain from company name
    if (k === "companyName") {
      setForm(p => ({
        ...p,
        companyName: v,
        subdomain: v.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
      }))
    }
  }

  async function handleSubmit() {
    if (form.password !== form.confirmPw) { setError("Passwords do not match."); return }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return }
    setError("")

    startTransition(async () => {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, planSlug: selectedPlan }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Something went wrong.")
        return
      }
      router.push("/login?onboarded=1")
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 py-12 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-3">
          <Star className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Start your free trial</h1>
        <p className="text-slate-400 mt-2">14 days free, no credit card required</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-10">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
              step === s ? "bg-indigo-600 text-white" :
              step > s  ? "bg-green-600 text-white" :
              "bg-slate-700 text-slate-400"
            )}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={cn("w-12 h-0.5", step > s ? "bg-green-600" : "bg-slate-700")} />}
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Step 1 — Pick plan */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-white text-center mb-6">Choose your plan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    "relative rounded-2xl border p-5 cursor-pointer transition-all",
                    selectedPlan === plan.id
                      ? "border-indigo-500 bg-indigo-600/10 ring-2 ring-indigo-500"
                      : "border-slate-700 bg-slate-800/60 hover:border-slate-500",
                    plan.highlight && "border-indigo-400"
                  )}
                >
                  {plan.highlight && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-3">
                      Most popular
                    </Badge>
                  )}
                  <h3 className="font-semibold text-white text-lg">{plan.name}</h3>
                  <div className="mt-1 mb-4">
                    {plan.price === null
                      ? <span className="text-2xl font-bold text-white">Custom</span>
                      : <><span className="text-3xl font-bold text-white">${plan.price}</span><span className="text-slate-400 text-sm">/mo</span></>
                    }
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Button
                onClick={() => setStep(2)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 h-11 rounded-xl"
              >
                Continue with {PLANS.find(p => p.id === selectedPlan)?.name} →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Company details */}
        {step === 2 && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-semibold text-white text-center mb-6">Set up your workspace</h2>
            <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Company Name
                </Label>
                <Input
                  value={form.companyName}
                  onChange={e => update("companyName", e.target.value)}
                  placeholder="Acme Corp"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Subdomain
                </Label>
                <div className="flex items-center">
                  <Input
                    value={form.subdomain}
                    onChange={e => update("subdomain", e.target.value)}
                    placeholder="acme"
                    className="bg-slate-900 border-slate-600 text-white rounded-r-none"
                  />
                  <span className="bg-slate-700 border border-l-0 border-slate-600 text-slate-400 px-3 py-2 text-sm rounded-r-md whitespace-nowrap">
                    .reviewpulse.io
                  </span>
                </div>
                <p className="text-slate-500 text-xs">You can configure a custom domain later.</p>
              </div>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (!form.companyName || !form.subdomain) { setError("Fill in all fields."); return }
                    setError(""); setStep(3)
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Continue →
                </Button>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          </div>
        )}

        {/* Step 3 — Admin account */}
        {step === 3 && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-semibold text-white text-center mb-6">Create your admin account</h2>
            <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-slate-300 flex items-center gap-2">
                  <User className="w-4 h-4" /> Full Name
                </Label>
                <Input
                  value={form.adminName}
                  onChange={e => update("adminName", e.target.value)}
                  placeholder="Jane Doe"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Email</Label>
                <Input
                  type="email"
                  value={form.adminEmail}
                  onChange={e => update("adminEmail", e.target.value)}
                  placeholder="jane@acme.com"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Password
                </Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => update("password", e.target.value)}
                  placeholder="Min 8 characters"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Confirm Password</Label>
                <Input
                  type="password"
                  value={form.confirmPw}
                  onChange={e => update("confirmPw", e.target.value)}
                  placeholder="Re-enter password"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={pending}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create workspace
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
