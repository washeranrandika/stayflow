"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi } from "@/lib/api";
import { usePathname } from "next/navigation";
import { Building2, Plus, Bell, ChevronDown, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { useActiveProperty } from "@/hooks/useActiveProperty";

const ORG_LEVEL_ROUTES = ["/roles", "/subscription", "/audit-logs", "/settings", "/properties"];

export function Header({ userName, userRole }: { userName: string; userRole?: string }) {
  const pathname = usePathname();
  const isOrgLevelPage = ORG_LEVEL_ROUTES.some((route) => pathname?.startsWith(route));

  const { selectedPropertyId, selectedProperty, properties, setProperty } = useActiveProperty();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSelectProperty = (id: string) => {
    setProperty(id);
    setIsDropdownOpen(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        {isOrgLevelPage ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Organization-Wide Settings</span>
          </div>
        ) : (
          /* Property Switcher */
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>{selectedProperty ? selectedProperty.name : "All Properties"}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                <button
                  onClick={() => handleSelectProperty("all")}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>All Properties</span>
                  {selectedPropertyId === "all" && <Check className="w-4 h-4 text-blue-600" />}
                </button>
                {properties.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProperty(p.id)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="truncate">{p.name}</span>
                    {selectedPropertyId === p.id && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Check-in Button */}
        <Link
          href="/check-in"
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Walk-in Check-in</span>
        </Link>

        {/* User Info */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-slate-900 leading-none">{userName}</p>
            {userRole && <p className="text-[10px] text-slate-500 capitalize leading-tight mt-0.5">{userRole.toLowerCase()}</p>}
          </div>
        </div>
      </div>
    </header>
  );
}
