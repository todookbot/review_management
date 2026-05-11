"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard, Building2, CreditCard, Receipt,
  Settings, ChevronLeft, ChevronRight, Shield, LogOut,
  Layers,
} from "lucide-react"
import { cn }    from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"

const NAV = [
  { label: "Dashboard",  href: "/superadmin",          icon: LayoutDashboard },
  { label: "Tenants",    href: "/superadmin/tenants",   icon: Building2       },
  { label: "Plans",      href: "/superadmin/plans",     icon: Layers          },
  { label: "Billing",    href: "/superadmin/billing",   icon: Receipt         },
  { label: "Settings",   href: "/superadmin/settings",  icon: Settings        },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}>
        {/* Brand */}
        <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-slate-800", collapsed && "justify-center px-0")}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-bold text-sm text-white leading-none">Super Admin</p>
              <p className="text-xs text-slate-500 mt-0.5">ReviewPulse Platform</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-red-600/20 text-red-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-slate-800 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn("w-full text-slate-400 hover:text-red-400 hover:bg-slate-800 justify-start gap-3",
              collapsed && "justify-center px-0")}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && "Sign out"}
          </Button>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="w-full flex items-center justify-center py-1.5 text-slate-600 hover:text-slate-400 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-slate-800 bg-slate-900">
          <h1 className="text-slate-200 font-semibold text-sm">
            {NAV.find(n => n.href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(n.href))?.label ?? "Super Admin"}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md">Platform Admin</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  )
}
