"use client"

import { useState, useTransition } from "react"
import { signIn }                  from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Star, Shield, Loader2 } from "lucide-react"
import { Button }    from "@/components/ui/button"
import { Input }     from "@/components/ui/input"
import { Label }     from "@/components/ui/label"
import { cn }        from "@/lib/utils"

type Mode = "tenant" | "superadmin"

import { Suspense } from "react"

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl  = searchParams.get("callbackUrl") ?? "/"

  const [mode,    setMode]    = useState<Mode>("tenant")
  const [email,   setEmail]   = useState("")
  const [pass,    setPass]    = useState("")
  const [showPw,  setShowPw]  = useState(false)
  const [error,   setError]   = useState("")
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password: pass,
        redirect: false,
      })

      if (res?.error) {
        setError("Invalid email or password.")
        return
      }

      // Fetch session to determine role-based redirect
      const session = await fetch("/api/auth/session").then(r => r.json())
      const role    = session?.user?.role

      if (role === "SUPER_ADMIN") {
        router.push("/superadmin")
      } else {
        // Tenant dashboard lives at "/" — (dashboard)/page.tsx
        const dest = !callbackUrl || callbackUrl === "/" || callbackUrl.includes("/login")
          ? "/"
          : callbackUrl
        router.push(dest)
      }
    })
  }

  return (
    <div className="w-full max-w-md mx-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
          <Star className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">ReviewPulse</h1>
        <p className="text-slate-400 text-sm mt-1">Global Review Management Platform</p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-slate-800/60 p-1 mb-6 border border-slate-700">
        {(["tenant", "superadmin"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError("") }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
              mode === m
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            )}
          >
            {m === "superadmin" ? <Shield className="w-4 h-4" /> : <Star className="w-4 h-4" />}
            {m === "tenant" ? "Tenant Login" : "Super Admin"}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-1">
          {mode === "superadmin" ? "Platform Admin" : "Welcome back"}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {mode === "superadmin"
            ? "Manage tenants, plans, and platform settings."
            : "Sign in to manage your reviews and responses."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={mode === "superadmin" ? "admin@reviewpulse.io" : "you@company.com"}
              required
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-indigo-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-11 rounded-lg font-medium"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Sign in
          </Button>
        </form>

        {mode === "tenant" && (
          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              New to ReviewPulse?{" "}
              <a href="/onboard" className="text-indigo-400 hover:text-indigo-300 font-medium">
                Start free trial
              </a>
            </p>
          </div>
        )}
      </div>

      {/* Demo credentials hint */}
      <div className="mt-4 text-center">
        <p className="text-slate-500 text-xs">
          Demo — Tenant: <span className="text-slate-400">alice@acme.com / password123</span>
          {" · "}Super Admin: <span className="text-slate-400">admin@reviewpulse.io / admin123</span>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
