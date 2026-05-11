"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge }   from "@/components/ui/badge"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Plug, Plus, CheckCircle, AlertCircle, RefreshCw,
  Key, Globe, Webhook, Copy, Eye, EyeOff, Trash2, Loader2,
} from "lucide-react"
import { toast }  from "sonner"
import { PLATFORM_CONFIG } from "@/lib/portals"

// ── Types ─────────────────────────────────────────────────────────────────────

type Source = {
  id: string; platform: string; displayName: string; authMode: string
  status: string; locationName: string | null; productName: string | null
  lastSyncedAt: string | null; lastSyncError: string | null
  webhookUrl: string | null; externalAccountId: string | null
}

const CATEGORIES = ["location", "product", "app", "social", "hospitality", "internal"] as const
type AuthMode = "API_KEY" | "OAUTH" | "WEBHOOK"

// ── Component ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { data: session } = useSession()
  const tenantId = session?.user?.tenantId ?? "00000000-0000-0000-0000-000000000000"

  // ── State ──────────────────────────────────────────────────────────────────
  const [sources,      setSources]      = useState<Source[]>([])
  const [loadingSrc,   setLoadingSrc]   = useState(true)
  const [addOpen,      setAddOpen]      = useState(false)
  const [selectedPlat, setSelectedPlat] = useState<string | null>(null)
  const [authMode,     setAuthMode]     = useState<AuthMode>("API_KEY")
  const [apiKey,       setApiKey]       = useState("")
  const [showKey,      setShowKey]      = useState(false)
  const [displayName,  setDisplayName]  = useState("")
  const [locationId,   setLocationId]   = useState("")
  const [connecting,   setConnecting]   = useState(false)
  const [filterCat,    setFilterCat]    = useState("ALL")
  const [webhookInfo,  setWebhookInfo]  = useState<{ url: string; secret: string } | null>(null)
  const [oauthPending, setOauthPending] = useState(false)

  // ── Load real sources from DB ──────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return
    fetch(`/api/sources?tenantId=${tenantId}`)
      .then(r => r.json())
      .then(d => { setSources(d.sources ?? []); setLoadingSrc(false) })
      .catch(() => setLoadingSrc(false))
  }, [tenantId])

  const platMeta = selectedPlat ? PLATFORM_CONFIG[selectedPlat] : null
  const connectedPlatforms = new Set(sources.map(s => s.platform))

  // Derive auth modes from the adapter registry (via platform config)
  function getAuthModes(platform: string): AuthMode[] {
    const oauthOnly  = ["GOOGLE_MY_BUSINESS", "AIRBNB", "INSTAGRAM", "TWITTER", "LINKEDIN", "REDDIT", "FACEBOOK"]
    const webhookOk  = ["SHOPIFY", "WOOCOMMERCE", "FACEBOOK", "CUSTOM_API", "INAPP_SDK"]
    const noneMode   = ["QR_FEEDBACK", "EMAIL_SURVEY"]

    if (noneMode.includes(platform))   return []
    if (oauthOnly.includes(platform))  return ["OAUTH"]
    if (webhookOk.includes(platform))  return ["API_KEY", "WEBHOOK"]
    return ["API_KEY"]
  }

  const availableAuthModes = selectedPlat ? getAuthModes(selectedPlat) : []

  const displayedPlatforms = Object.entries(PLATFORM_CONFIG).filter(([key]) =>
    filterCat === "ALL" || PLATFORM_CONFIG[key].category === filterCat
  )

  // ── Real connect handler ───────────────────────────────────────────────────
  async function handleConnect() {
    if (!selectedPlat || !tenantId) return
    if (!displayName.trim()) { toast.error("Display name is required"); return }
    setConnecting(true)

    try {
      // ── OAuth ────────────────────────────────────────────────────────────
      if (authMode === "OAUTH") {
        setOauthPending(true)
        const res  = await fetch("/api/integrations/connect", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            authMode: "OAUTH",
            tenantId,
            platform: selectedPlat,
            displayName,
          }),
        })
        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error ?? "Failed to initiate OAuth")
          setConnecting(false)
          setOauthPending(false)
          return
        }

        if (data.authUrl) {
          // Hard redirect to Google/Facebook/etc consent screen
          toast.info(`Redirecting to ${platMeta?.name}…`)
          setAddOpen(false)
          window.location.href = data.authUrl   // ← The real redirect
          return
        }

        toast.error("No OAuth URL returned")
        setConnecting(false)
        setOauthPending(false)
        return
      }

      // ── Webhook ──────────────────────────────────────────────────────────
      if (authMode === "WEBHOOK") {
        const res  = await fetch("/api/integrations/connect", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            authMode: "WEBHOOK",
            tenantId,
            platform: selectedPlat,
            displayName,
            locationId: locationId || undefined,
          }),
        })
        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error ?? "Failed to create webhook")
          setConnecting(false)
          return
        }

        setWebhookInfo({ url: data.webhookUrl, secret: data.webhookSecret })
        setConnecting(false)
        // Refresh sources list
        fetch(`/api/sources?tenantId=${tenantId}`).then(r => r.json()).then(d => setSources(d.sources ?? []))
        return
      }

      // ── API Key ──────────────────────────────────────────────────────────
      if (!apiKey.trim()) {
        toast.error("API Key is required")
        setConnecting(false)
        return
      }

      const res  = await fetch("/api/integrations/connect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          authMode:    "API_KEY",
          tenantId,
          platform:    selectedPlat,
          displayName,
          apiKey,
          locationId:  locationId || undefined,
          locationName: locationId || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to connect")
        setConnecting(false)
        return
      }

      toast.success(`${platMeta?.name} connected successfully!`)
      setAddOpen(false)
      resetForm()
      // Refresh sources
      fetch(`/api/sources?tenantId=${tenantId}`).then(r => r.json()).then(d => setSources(d.sources ?? []))

    } catch (err) {
      toast.error("Connection failed — check your credentials")
    } finally {
      setConnecting(false)
    }
  }

  async function handleDelete(sourceId: string) {
    if (!tenantId) return
    await fetch(`/api/sources/${sourceId}`, { method: "DELETE" })
    setSources(prev => prev.filter(s => s.id !== sourceId))
    toast.success("Source removed")
  }

  function resetForm() {
    setSelectedPlat(null); setApiKey(""); setDisplayName("")
    setLocationId(""); setShowKey(false); setWebhookInfo(null); setOauthPending(false)
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Connected Sources</h2>
          <p className="text-xs text-muted-foreground">
            {loadingSrc ? "Loading…" : `${sources.length} connection${sources.length !== 1 ? "s" : ""} active`}
          </p>
        </div>
        <Button className="gap-2" size="sm" onClick={() => { resetForm(); setAddOpen(true) }}>
          <Plus className="w-4 h-4" /> Add Source
        </Button>
      </div>

      {/* Connected sources */}
      {loadingSrc ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading sources…
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <Plug className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No sources connected yet</p>
          <p className="text-xs mt-1">Click "Add Source" to connect your first review platform.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => {
            const pConfig = PLATFORM_CONFIG[source.platform]
            const isError = source.status === "ERROR"
            const isPending = source.status === "PENDING_AUTH"
            return (
              <Card key={source.id} className={isError ? "border-red-200 bg-red-50/30" : isPending ? "border-amber-200 bg-amber-50/30" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: `${pConfig?.color ?? "#6366f1"}15` }}>
                      {pConfig?.icon ?? "🔌"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{source.displayName}</span>
                        <Badge variant={isError ? "destructive" : "outline"}
                          className={`text-xs px-1.5 ${isError ? "" : isPending ? "text-amber-600 border-amber-200" : "text-green-600 border-green-200"}`}>
                          {isError   ? <><AlertCircle  className="w-2.5 h-2.5 mr-1" />Error</>
                          : isPending ? <><RefreshCw   className="w-2.5 h-2.5 mr-1" />Pending Auth</>
                          :             <><CheckCircle className="w-2.5 h-2.5 mr-1" />Active</>}
                        </Badge>
                        <Badge variant="outline" className="text-xs px-1.5">
                          {source.authMode === "API_KEY" ? <Key     className="w-2.5 h-2.5 mr-1" />
                          : source.authMode === "OAUTH"  ? <Globe   className="w-2.5 h-2.5 mr-1" />
                          :                                <Webhook className="w-2.5 h-2.5 mr-1" />}
                          {source.authMode}
                        </Badge>
                      </div>
                      {isError && source.lastSyncError && (
                        <p className="text-xs text-red-600 mt-0.5">{source.lastSyncError}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {source.locationName  && <span>{source.locationName}</span>}
                        {source.productName   && <span>{source.productName}</span>}
                        {source.externalAccountId && <span>· {source.externalAccountId}</span>}
                        {source.lastSyncedAt  && (
                          <span>· Synced {new Date(source.lastSyncedAt).toLocaleTimeString()}</span>
                        )}
                        {source.webhookUrl && (
                          <span className="font-mono truncate max-w-xs">{source.webhookUrl}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {(isError || isPending) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-600 border-amber-200"
                          onClick={() => {
                            setSelectedPlat(source.platform)
                            setDisplayName(source.displayName)
                            setAuthMode(source.authMode as AuthMode)
                            setAddOpen(true)
                          }}>
                          <RefreshCw className="w-3 h-3" /> Reconnect
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(source.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Source Dialog */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) { setAddOpen(false); resetForm() } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Review Source</DialogTitle>
            <DialogDescription>Connect any review platform via API Key, OAuth, or Webhook.</DialogDescription>
          </DialogHeader>

          {/* OAuth pending redirect state */}
          {oauthPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Redirecting to {platMeta?.name}…</p>
              <p className="text-xs text-muted-foreground">You'll be brought back here after authorizing.</p>
            </div>

          ) : !selectedPlat ? (
            /* Platform picker */
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {["ALL", ...CATEGORIES].map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
                      filterCat === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted border-border"
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {displayedPlatforms.map(([key, config]) => (
                  <button key={key}
                    onClick={() => {
                      const modes = getAuthModes(key)
                      setSelectedPlat(key)
                      setDisplayName(config.name)
                      setAuthMode(modes[0] ?? "API_KEY")
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left relative">
                    <span className="text-xl">{config.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{config.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{config.category}</p>
                    </div>
                    {connectedPlatforms.has(key) && (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 absolute top-2 right-2" />
                    )}
                  </button>
                ))}
              </div>
            </div>

          ) : webhookInfo ? (
            /* Webhook success */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Webhook endpoint created!</p>
                  <p className="text-xs text-green-700">Configure these in your {platMeta?.name} dashboard</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "WEBHOOK URL",    value: webhookInfo.url    },
                  { label: "SIGNING SECRET", value: webhookInfo.secret },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
                    <div className="flex gap-2">
                      <Input value={showKey || label === "WEBHOOK URL" ? value : "•".repeat(32)}
                        readOnly className="text-xs font-mono" />
                      {label === "SIGNING SECRET" && (
                        <Button size="sm" variant="outline" onClick={() => setShowKey(v => !v)}>
                          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => copy(value, label)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Store the secret safely — it won't be shown again.</p>
              </div>
              <Button className="w-full" onClick={() => { setAddOpen(false); resetForm() }}>Done</Button>
            </div>

          ) : (
            /* Auth form */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedPlat(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
                <span className="text-2xl">{platMeta?.icon}</span>
                <span className="font-semibold">{platMeta?.name}</span>
                <Badge variant="outline" className="text-xs capitalize">{platMeta?.category}</Badge>
              </div>

              {/* Auth mode tabs */}
              {availableAuthModes.length > 1 && (
                <div className="flex gap-2">
                  {availableAuthModes.map(mode => (
                    <button key={mode} onClick={() => setAuthMode(mode)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        authMode === mode ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                      }`}>
                      {mode === "API_KEY" && <Key     className="w-3.5 h-3.5" />}
                      {mode === "OAUTH"   && <Globe   className="w-3.5 h-3.5" />}
                      {mode === "WEBHOOK" && <Webhook className="w-3.5 h-3.5" />}
                      {mode === "API_KEY" ? "API Key" : mode === "OAUTH" ? "OAuth Login" : "Webhook"}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">DISPLAY NAME</p>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder={`e.g. NYC Store — ${platMeta?.name}`} className="text-sm" />
                </div>

                {authMode === "API_KEY" && (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">API KEY</p>
                      <div className="flex gap-2">
                        <Input type={showKey ? "text" : "password"} value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          placeholder="Paste your API key…" className="text-sm font-mono" />
                        <Button size="sm" variant="outline" onClick={() => setShowKey(v => !v)}>
                          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Stored encrypted in AWS Secrets Manager — never exposed in plaintext.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        {platMeta?.category === "product" ? "PRODUCT ID / ASIN" : "LOCATION ID"}
                        <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
                      </p>
                      <Input value={locationId} onChange={e => setLocationId(e.target.value)}
                        placeholder={platMeta?.category === "product" ? "e.g. B08N5WRWNW" : "e.g. place_id"}
                        className="text-sm" />
                    </div>
                  </>
                )}

                {authMode === "OAUTH" && (
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <p className="font-medium text-blue-800 text-sm">OAuth 2.0 Authorization</p>
                    </div>
                    <p className="text-blue-700 text-xs">
                      You'll be redirected to <strong>{platMeta?.name}</strong> to grant access.
                      After authorizing, you'll return here automatically.
                      Tokens are stored encrypted in AWS Secrets Manager.
                    </p>
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] space-y-1">
                      <p className="font-bold text-amber-800">Setup Required in Google Cloud Console:</p>
                      <p className="text-amber-700">1. Enable "My Business Business Information API"</p>
                      <p className="text-amber-700">2. Authorized Redirect URI:</p>
                      <code className="block bg-white p-1 border rounded select-all text-black">
                        {process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/google
                      </code>
                      <p className="text-amber-700 pt-1">3. Update <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code></p>
                    </div>
                  </div>
                )}

                {authMode === "WEBHOOK" && (
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                    <p className="font-medium text-purple-800 text-sm mb-1">Webhook Endpoint</p>
                    <p className="text-purple-700 text-xs">
                      A unique URL and HMAC signing secret will be generated.
                      Paste them into your {platMeta?.name} dashboard to start receiving real-time review events.
                    </p>
                  </div>
                )}
              </div>

              <Button className="w-full gap-2" onClick={handleConnect}
                disabled={connecting || !displayName || !tenantId}>
                {connecting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
                  : authMode === "OAUTH"
                  ? <><Globe   className="w-4 h-4" /> Authorize with {platMeta?.name}</>
                  : authMode === "WEBHOOK"
                  ? <><Webhook className="w-4 h-4" /> Generate Webhook</>
                  : <><Key     className="w-4 h-4" /> Validate & Connect</>}
              </Button>

              {!tenantId && (
                <p className="text-xs text-center text-muted-foreground">
                  Sign in to connect sources.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
