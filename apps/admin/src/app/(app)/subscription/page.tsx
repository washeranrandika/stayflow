"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Zap, Check, ShieldCheck, Building2, BedDouble, Users } from "lucide-react";

export default function SubscriptionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["currentSubscription"],
    queryFn: () => apiClient.get("/subscriptions/current"),
  });

  const sub = data?.data?.data;
  const plan = sub?.plan || {
    name: "Professional",
    max_properties: 3,
    max_rooms: 50,
    max_users: 10,
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription & Usage</h1>
        <p className="text-sm text-slate-500">
          Manage your SaaS subscription tier, feature entitlements, and property capacity.
        </p>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/30 text-blue-200 border border-blue-400/30">
              Active Tier
            </span>
            <h2 className="text-3xl font-extrabold mt-3">{plan.name} Plan</h2>
            <p className="text-sm text-blue-200 mt-1">
              Billed yearly • Full multi-tenant capabilities enabled
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold">$79</span>
            <span className="text-blue-200 text-sm"> / month</span>
          </div>
        </div>

        {/* Capacity Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-blue-800">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold">
              <Building2 className="w-4 h-4" />
              <span>Properties Allowed</span>
            </div>
            <p className="text-2xl font-bold mt-2">Up to {plan.max_properties}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold">
              <BedDouble className="w-4 h-4" />
              <span>Total Room Inventory</span>
            </div>
            <p className="text-2xl font-bold mt-2">Up to {plan.max_rooms}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold">
              <Users className="w-4 h-4" />
              <span>Team Members</span>
            </div>
            <p className="text-2xl font-bold mt-2">Up to {plan.max_users}</p>
          </div>
        </div>
      </div>

      {/* Plan Entitlements */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">Included Plan Capabilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Multi-Property Switching</p>
              <p className="text-xs text-slate-500">Manage multiple villas & guest houses under one organization account.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Dynamic Pricing Engine</p>
              <p className="text-xs text-slate-500">Hourly, day-use, and overnight billing with automated overtime charges.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Assistive ID OCR</p>
              <p className="text-xs text-slate-500">Fast guest identity extraction with encrypted private object storage.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Automated Housekeeping</p>
              <p className="text-xs text-slate-500">Turnaround task management with automated room status updates.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
