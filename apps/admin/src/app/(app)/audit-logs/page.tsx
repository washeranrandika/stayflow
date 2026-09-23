"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { FileText, Shield, Clock, User, Filter, Search, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

const CATEGORIES = [
  { label: "All Logs", value: "" },
  { label: "Auth & Logins", value: "auth." },
  { label: "Stays & Check-ins", value: "stay." },
  { label: "Rooms", value: "room" },
  { label: "Billing & Folios", value: "folio" },
  { label: "Staff & Members", value: "staff." },
];

export default function AuditLogsPage() {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const activeActionFilter = searchQuery || selectedCategory;

  const { data, isLoading } = useQuery({
    queryKey: ["auditLogs", activeActionFilter],
    queryFn: () => auditApi.list(activeActionFilter ? { action: activeActionFilter } : {}),
  });

  const rawData = data?.data?.data;
  const logs = Array.isArray(rawData) ? rawData : rawData?.items || [];
  const total = rawData?.total ?? logs.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Trail & Compliance</h1>
          <p className="text-sm text-slate-500">
            Immutable log of all operational events, check-ins, rate updates, and sensitive actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search action or entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = (!searchQuery && selectedCategory === cat.value) || (searchQuery === cat.value);
          return (
            <button
              key={cat.label}
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory(cat.value);
              }}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm",
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Payload Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading audit records...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No audit records found {activeActionFilter ? `matching "${activeActionFilter}"` : ""}.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium capitalize">{log.entity_type}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">
                      {log.entity_id ? log.entity_id.slice(0, 8) + "..." : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono max-w-xs truncate">
                      {log.new_values ? JSON.stringify(log.new_values) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
