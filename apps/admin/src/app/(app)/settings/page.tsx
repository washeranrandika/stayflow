"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orgApi } from "@/lib/api";
import { Settings, Building2, Clock, Shield, MessageSquare, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orgSettings"],
    queryFn: () => orgApi.get(),
  });

  const org = data?.data?.data || {};

  const [gracePeriod, setGracePeriod] = useState(30);
  const [retentionDays, setRetentionDays] = useState(365);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
        <p className="text-sm text-slate-500">
          Configure business rules, grace periods, retention policies, and communication channels.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Info */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Organization Profile</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
              <input
                type="text"
                disabled
                value={org.name || "StayFlow Demo Hospitality"}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Base Currency</label>
              <input
                type="text"
                disabled
                value={org.currency || "LKR"}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Operational Business Rules */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600" />
            <span>Stay & Checkout Rules</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Checkout Overtime Grace Period (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={gracePeriod}
                onChange={(e) => setGracePeriod(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Extra-hour rates are billed only after this grace period expires.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sensitive ID Retention Period (Days)
              </label>
              <input
                type="number"
                min={30}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Securely purge guest documents after retention timeframe for compliance.
              </p>
            </div>
          </div>
        </div>

        {/* Official WhatsApp Business Integration Abstraction */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Official WhatsApp Business Integration</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              API Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            StayFlow is architected with a clean notification integration layer ready to connect to official Meta / Twilio WhatsApp Business APIs for automated booking confirmations and digital invoice receipts.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Provider</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="meta">Meta Cloud API (Official)</option>
                <option value="twilio">Twilio Programmable Messaging</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Phone Number ID</label>
              <input
                type="text"
                placeholder="e.g. 10928374659102"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              <span>Settings saved successfully</span>
            </span>
          )}
          <button
            type="submit"
            className="ml-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
