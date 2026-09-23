"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2, LayoutDashboard, BedDouble, Calendar, Users, FileText,
  CreditCard, Sparkles, ClipboardList, BarChart3, Shield, Settings,
  LogOut, ChevronDown, Menu, X, Bell
} from "lucide-react";
import { clearTokens } from "@/lib/api-client";
import { authApi } from "@/lib/api";
import clsx from "clsx";

const navGroups = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/rooms", icon: BedDouble, label: "Rooms" },
      { href: "/room-types", icon: ClipboardList, label: "Room Types" },
      { href: "/bookings", icon: Calendar, label: "Bookings" },
      { href: "/guests", icon: Users, label: "Guests" },
      { href: "/stays", icon: Sparkles, label: "Active Stays" },
      { href: "/housekeeping", icon: ClipboardList, label: "Housekeeping" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/invoices", icon: FileText, label: "Invoices" },
      { href: "/payments", icon: CreditCard, label: "Payments" },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/properties", icon: Building2, label: "Properties" },
      { href: "/reports", icon: BarChart3, label: "Reports" },
      { href: "/staff", icon: Users, label: "Staff" },
      { href: "/roles", icon: Shield, label: "Roles & RBAC" },
      { href: "/audit-logs", icon: FileText, label: "Audit Logs" },
      { href: "/settings", icon: Settings, label: "Settings" },
      { href: "/subscription", icon: Sparkles, label: "Subscription" },
    ],
  },
];

export function Sidebar({ userName, orgName }: { userName: string; orgName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("sf_refresh_token") || "";
      await authApi.logout(refreshToken);
    } catch {}
    clearTokens();
    router.push("/login");
  };

  return (
    <aside
      className={clsx(
        "h-screen flex flex-col bg-slate-900 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">StayFlow</p>
              <p className="text-xs text-slate-400 truncate max-w-[140px]">{orgName}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-2 border-t border-slate-700">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
