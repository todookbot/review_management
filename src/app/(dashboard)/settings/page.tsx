"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Palette, Globe, Bot, Bell, Users, Shield,
  Save, Plus, Trash2, RefreshCw, Copy, ExternalLink
} from "lucide-react"
import { toast } from "sonner"

// Mock tenant state
const INITIAL_TENANT = {
  name:            "Acme Corp",
  slug:            "acme",
  customDomain:    "reviews.acme.com",
  brandName:       "Acme",
  primaryColor:    "#6366f1",
  secondaryColor:  "#f1f5f9",
  logoUrl:         "",
  plan:            "GROWTH",
  settings: {
    autoTagging:       true,
    autoDraft:         true,
    defaultAiProvider: "CLAUDE" as "CLAUDE" | "OPENAI",
    responseLanguage:  "en",
    notifyOnNewReview: true,
    notifyOnNegative:  true,
    urgencyThreshold:  3,
  },
}

const MOCK_TEAM = [
  { id: "u1", name: "Jane Doe",    email: "jane@acme.com",   role: "TENANT_ADMIN", isActive: true },
  { id: "u2", name: "Mark Singh",  email: "mark@acme.com",   role: "MANAGER",      isActive: true },
  { id: "u3", name: "Lucy Kim",    email: "lucy@acme.com",   role: "RESPONDER",    isActive: true },
  { id: "u4", name: "Tom Baker",   email: "tom@acme.com",    role: "VIEWER",       isActive: false },
]

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:  "bg-red-100 text-red-700",
  TENANT_ADMIN: "bg-purple-100 text-purple-700",
  MANAGER:      "bg-blue-100 text-blue-700",
  RESPONDER:    "bg-green-100 text-green-700",
  VIEWER:       "bg-gray-100 text-gray-600",
}

export default function SettingsPage() {
  const [tenant,   setTenant]   = useState(INITIAL_TENANT)
  const [saving,   setSaving]   = useState(false)
  const [invEmail, setInvEmail] = useState("")
  const [invRole,  setInvRole]  = useState("RESPONDER")

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 900))
    setSaving(false)
    toast.success("Settings saved successfully")
  }

  async function handleInvite() {
    if (!invEmail) return
    await new Promise(r => setTimeout(r, 500))
    toast.success(`Invite sent to ${invEmail}`)
    setInvEmail("")
  }

  function updateSetting<K extends keyof typeof INITIAL_TENANT["settings"]>(
    key: K, value: typeof INITIAL_TENANT["settings"][K]
  ) {
    setTenant(t => ({ ...t, settings: { ...t.settings, [key]: value } }))
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Tabs defaultValue="branding">
        <TabsList className="mb-4">
          <TabsTrigger value="branding"  className="gap-1.5"><Palette className="w-3.5 h-3.5" />White Label</TabsTrigger>
          <TabsTrigger value="ai"        className="gap-1.5"><Bot     className="w-3.5 h-3.5" />AI Config</TabsTrigger>
          <TabsTrigger value="team"      className="gap-1.5"><Users   className="w-3.5 h-3.5" />Team</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="w-3.5 h-3.5" />Notifications</TabsTrigger>
        </TabsList>

        {/* ── White Label ───────────────────────────────────────────────── */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Brand Identity</CardTitle>
              <CardDescription className="text-xs">
                Customize how your review portal looks to your team and customers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">BRAND NAME</p>
                  <Input
                    value={tenant.brandName}
                    onChange={e => setTenant(t => ({ ...t, brandName: e.target.value }))}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Shown in the portal header & emails</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">SUBDOMAIN</p>
                  <div className="flex items-center gap-1">
                    <Input
                      value={tenant.slug}
                      onChange={e => setTenant(t => ({ ...t, slug: e.target.value }))}
                      className="text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">.reviewpulse.io</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">CUSTOM DOMAIN</p>
                <div className="flex gap-2">
                  <Input
                    value={tenant.customDomain}
                    onChange={e => setTenant(t => ({ ...t, customDomain: e.target.value }))}
                    placeholder="reviews.yourbrand.com"
                    className="text-sm"
                  />
                  <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0">
                    <Globe className="w-3.5 h-3.5" />Verify DNS
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Add CNAME record: <code className="font-mono bg-muted px-1 rounded">reviews.yourbrand.com → cname.reviewpulse.io</code>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">PRIMARY COLOR</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={tenant.primaryColor}
                      onChange={e => setTenant(t => ({ ...t, primaryColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border"
                    />
                    <Input
                      value={tenant.primaryColor}
                      onChange={e => setTenant(t => ({ ...t, primaryColor: e.target.value }))}
                      className="text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">SECONDARY COLOR</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={tenant.secondaryColor}
                      onChange={e => setTenant(t => ({ ...t, secondaryColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border"
                    />
                    <Input
                      value={tenant.secondaryColor}
                      onChange={e => setTenant(t => ({ ...t, secondaryColor: e.target.value }))}
                      className="text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-lg border-2 border-dashed">
                <p className="text-xs text-muted-foreground mb-3">PREVIEW</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: tenant.primaryColor }}
                  >
                    {tenant.brandName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: tenant.primaryColor }}>
                      {tenant.brandName} Reviews
                    </p>
                    <p className="text-xs text-muted-foreground">{tenant.customDomain || `${tenant.slug}.reviewpulse.io`}</p>
                  </div>
                  <Badge className="ml-auto text-xs" style={{ background: tenant.primaryColor }}>
                    {tenant.plan}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI Config ─────────────────────────────────────────────────── */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Response Configuration</CardTitle>
              <CardDescription className="text-xs">Control how AI generates review responses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Default AI provider */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">DEFAULT AI PROVIDER</p>
                <div className="flex gap-3">
                  {(["CLAUDE", "OPENAI"] as const).map(provider => (
                    <button
                      key={provider}
                      onClick={() => updateSetting("defaultAiProvider", provider)}
                      className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        tenant.settings.defaultAiProvider === provider
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold ${
                        provider === "CLAUDE" ? "bg-orange-500" : "bg-green-600"
                      }`}>
                        {provider === "CLAUDE" ? "C" : "G"}
                      </div>
                      {provider === "CLAUDE" ? "Claude (Anthropic)" : "GPT-4o (OpenAI)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-draft toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Auto-generate drafts</p>
                  <p className="text-xs text-muted-foreground">Automatically create AI drafts when new reviews arrive</p>
                </div>
                <button
                  onClick={() => updateSetting("autoDraft", !tenant.settings.autoDraft)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${tenant.settings.autoDraft ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tenant.settings.autoDraft ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              <Separator />

              {/* Auto NLP tagging toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Auto NLP tagging</p>
                  <p className="text-xs text-muted-foreground">Run Comprehend + Claude NLP on every new review</p>
                </div>
                <button
                  onClick={() => updateSetting("autoTagging", !tenant.settings.autoTagging)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${tenant.settings.autoTagging ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tenant.settings.autoTagging ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* Urgency threshold */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">URGENCY THRESHOLD</p>
                <Select
                  value={String(tenant.settings.urgencyThreshold)}
                  onValueChange={v => updateSetting("urgencyThreshold", parseInt(v ?? "3"))}
                >
                  <SelectTrigger className="w-48 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map(r => (
                      <SelectItem key={r} value={String(r)}>
                        {r}★ and below = Urgent
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Reviews at or below this rating are flagged as urgent</p>
              </div>

              {/* Response language */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">RESPONSE LANGUAGE</p>
                <Select
                  value={tenant.settings.responseLanguage}
                  onValueChange={v => updateSetting("responseLanguage", v ?? "en")}
                >
                  <SelectTrigger className="w-48 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { code: "en", name: "English" },
                      { code: "es", name: "Spanish" },
                      { code: "fr", name: "French" },
                      { code: "de", name: "German" },
                      { code: "hi", name: "Hindi" },
                      { code: "auto", name: "Auto (match review language)" },
                    ].map(({ code, name }) => (
                      <SelectItem key={code} value={code}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team ──────────────────────────────────────────────────────── */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Team Members</CardTitle>
              <CardDescription className="text-xs">
                Manage who has access to your review portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Invite */}
              <div className="flex gap-2">
                <Input
                  value={invEmail}
                  onChange={e => setInvEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="text-sm"
                />
                <Select value={invRole} onValueChange={v => setInvRole(v ?? "RESPONDER")}>
                  <SelectTrigger className="w-36 text-sm shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["MANAGER", "RESPONDER", "VIEWER"].map(r => (
                      <SelectItem key={r} value={r} className="text-sm capitalize">{r.toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="gap-1 shrink-0" onClick={handleInvite}>
                  <Plus className="w-3.5 h-3.5" />Invite
                </Button>
              </div>

              <Separator />

              {/* Team list */}
              {MOCK_TEAM.map(member => (
                <div key={member.id} className="flex items-center gap-3 py-1">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {member.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {member.name}
                      {!member.isActive && (
                        <span className="text-xs text-muted-foreground font-normal">(inactive)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge className={`text-xs ${ROLE_COLORS[member.role]}`} variant="outline">
                    {member.role.toLowerCase().replace("_", " ")}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications ─────────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email Notifications (AWS SES)</CardTitle>
              <CardDescription className="text-xs">Choose when to receive email alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: "notifyOnNewReview" as const,
                  label: "New review received",
                  desc: "Get an email whenever a new review is ingested",
                },
                {
                  key: "notifyOnNegative" as const,
                  label: "Negative review (urgent)",
                  desc: `Reviews rated ${tenant.settings.urgencyThreshold}★ or below trigger an immediate alert`,
                },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <button
                    onClick={() => updateSetting(key, !tenant.settings[key])}
                    className={`w-10 h-5 rounded-full transition-colors relative ${tenant.settings[key] ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tenant.settings[key] ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save button */}
      <div className="flex justify-end">
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          {saving
            ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</>
            : <><Save className="w-4 h-4" />Save Settings</>}
        </Button>
      </div>
    </div>
  )
}
