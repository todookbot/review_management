"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  BarChart3, Inbox, FileText, Plug, Settings, Star,
  ChevronLeft, ChevronRight, Bell, AlertTriangle, LogOut,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"

const NAV = [
  { label: "Analytics",    href: "/",             icon: BarChart3 },
  { label: "Reviews",      href: "/reviews",      icon: Inbox,     badge: "new" },
  { label: "Drafts",       href: "/drafts",       icon: FileText,  badge: "pending" },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Settings",     href: "/settings",     icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {/* Brand */}
        <div className={cn("flex items-center gap-3 px-4 py-5 border-b", collapsed && "justify-center px-0")}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
            R
          </div>
          {!collapsed && (
            <div>
              <p className="font-bold text-sm leading-none">ReviewPulse</p>
              <p className="text-xs text-muted-foreground mt-0.5">Multi-tenant</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(({ label, href, icon: Icon, badge }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{label}</span>
                    {badge === "new" && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">3</Badge>
                    )}
                    {badge === "pending" && (
                      <Badge className="text-xs px-1.5 py-0 bg-amber-500">5</Badge>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        <Separator />

        {/* User */}
        <div className={cn("flex items-center gap-2 p-3", collapsed && "justify-center p-2")}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {session?.user?.name?.split(" ").map(n => n[0]).join("").slice(0,2) ?? "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{session?.user?.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {(session?.user?.role ?? "VIEWER").toLowerCase().replace("_", " ")}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center justify-center h-9 border-t hover:bg-muted transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
            : <ChevronLeft  className="w-4 h-4 text-muted-foreground" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0">
          <div>
            <h1 className="text-sm font-semibold">
              {NAV.find(n => n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))?.label ?? "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-md hover:bg-muted">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </button>
            <button className="relative p-2 rounded-md hover:bg-muted text-amber-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                2
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
          {children}
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  )
}
