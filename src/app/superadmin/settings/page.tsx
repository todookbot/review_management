"use client"

import { useState } from "react"
import { Save, Globe, Palette, Bell, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast }  from "sonner"

export default function SuperAdminSettings() {
  const [brand, setBrand] = useState({
    platformName:  "ReviewPulse",
    primaryColor:  "#6366f1",
    supportEmail:  "support@reviewpulse.io",
    websiteUrl:    "https://reviewpulse.io",
    logoUrl:       "",
    faviconUrl:    "",
  })

  const [security, setSecurity] = useState({
    requireMfa:           false,
    allowSelfOnboard:     true,
    requireEmailVerify:   false,
    sessionTimeoutHours:  24,
    maxLoginAttempts:     5,
  })

  const [notifications, setNotifications] = useState({
    newTenantAlert:    true,
    trialExpireAlert:  true,
    paymentFailAlert:  true,
    adminEmail:        "admin@reviewpulse.io",
  })

  function handleSave() {
    toast.success("Platform settings saved")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Platform Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Global configuration for the ReviewPulse platform.</p>
      </div>

      <Tabs defaultValue="brand">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="brand"         className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white gap-2">
            <Palette className="w-4 h-4" /> Platform Brand
          </TabsTrigger>
          <TabsTrigger value="security"      className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white gap-2">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white gap-2">
            <Bell className="w-4 h-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        {/* Brand tab */}
        <TabsContent value="brand" className="mt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Platform Name</Label>
                <Input value={brand.platformName} onChange={e => setBrand(p => ({ ...p, platformName: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
                <p className="text-slate-500 text-xs">Shown in the login page and emails.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Support Email</Label>
                <Input value={brand.supportEmail} onChange={e => setBrand(p => ({ ...p, supportEmail: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Website URL</Label>
                <Input value={brand.websiteUrl} onChange={e => setBrand(p => ({ ...p, websiteUrl: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Primary Color</Label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={brand.primaryColor}
                    onChange={e => setBrand(p => ({ ...p, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-slate-600 cursor-pointer bg-transparent"
                  />
                  <Input value={brand.primaryColor} onChange={e => setBrand(p => ({ ...p, primaryColor: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Logo URL</Label>
                <Input value={brand.logoUrl} onChange={e => setBrand(p => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://…/logo.png" className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Favicon URL</Label>
                <Input value={brand.faviconUrl} onChange={e => setBrand(p => ({ ...p, faviconUrl: e.target.value }))}
                  placeholder="https://…/favicon.ico" className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
            </div>

            {/* Live preview */}
            <div className="border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-3 font-medium uppercase tracking-wide">Login Preview</p>
              <div className="bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-800 rounded-lg p-6 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: brand.primaryColor }}>
                  <span className="text-white font-bold text-lg">{brand.platformName[0]}</span>
                </div>
                <p className="text-white font-bold text-lg">{brand.platformName}</p>
                <p className="text-slate-400 text-sm">Global Review Management Platform</p>
              </div>
            </div>

            <Button onClick={handleSave} className="gap-2" style={{ backgroundColor: brand.primaryColor }}>
              <Save className="w-4 h-4" /> Save Brand Settings
            </Button>
          </div>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            {[
              { key: "requireMfa",         label: "Require MFA for all admins",   desc: "Enforce 2FA for TENANT_ADMIN and above."     },
              { key: "allowSelfOnboard",   label: "Allow self-onboarding",         desc: "Tenants can sign up from the /onboard page." },
              { key: "requireEmailVerify", label: "Require email verification",    desc: "Users must verify email before first login." },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
                <Switch
                  checked={security[key as keyof typeof security] as boolean}
                  onCheckedChange={v => setSecurity(p => ({ ...p, [key]: v }))}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Session Timeout (hours)</Label>
                <Input type="number" value={security.sessionTimeoutHours}
                  onChange={e => setSecurity(p => ({ ...p, sessionTimeoutHours: +e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Max Login Attempts</Label>
                <Input type="number" value={security.maxLoginAttempts}
                  onChange={e => setSecurity(p => ({ ...p, maxLoginAttempts: +e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>
            <Button onClick={handleSave} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
              <Save className="w-4 h-4" /> Save Security Settings
            </Button>
          </div>
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications" className="mt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Admin Alert Email</Label>
              <Input value={notifications.adminEmail}
                onChange={e => setNotifications(p => ({ ...p, adminEmail: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white" />
            </div>
            {[
              { key: "newTenantAlert",   label: "New tenant signed up",      desc: "Alert when a new tenant self-onboards." },
              { key: "trialExpireAlert", label: "Trial expiring (3 days)",   desc: "Remind admin of upcoming trial expirations." },
              { key: "paymentFailAlert", label: "Payment failure",            desc: "Alert when a subscription payment fails." },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
                <Switch
                  checked={notifications[key as keyof typeof notifications] as boolean}
                  onCheckedChange={v => setNotifications(p => ({ ...p, [key]: v }))}
                />
              </div>
            ))}
            <Button onClick={handleSave} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
              <Save className="w-4 h-4" /> Save Notification Settings
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
