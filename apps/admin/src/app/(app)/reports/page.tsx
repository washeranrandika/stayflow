"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, propertiesApi } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  CreditCard,
  DollarSign,
  BedDouble,
  Sparkles,
  Receipt,
  User,
  ShieldCheck,
  RefreshCw,
  PieChart,
  ArrowUpRight,
} from "lucide-react";

import { useActiveProperty } from "@/hooks/useActiveProperty";

export default function ReportsPage() {
  const { propertyIdParam, selectedProperty } = useActiveProperty();
  const [reportType, setReportType] = useState<"overview" | "revenue" | "occupancy" | "payments">("overview");
  const [period, setPeriod] = useState<"TODAY" | "7D" | "30D" | "MONTH">("30D");

  const getDates = () => {
    const today = new Date();
    const to_date = today.toISOString().split("T")[0];
    if (period === "TODAY") return { from_date: to_date, to_date };
    if (period === "7D") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from_date: d.toISOString().split("T")[0], to_date };
    }
    if (period === "MONTH") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from_date: firstDay.toISOString().split("T")[0], to_date };
    }
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return { from_date: d.toISOString().split("T")[0], to_date };
  };

  const { from_date, to_date } = getDates();

  const queryParams = {
    from_date,
    to_date,
    ...(propertyIdParam ? { property_id: propertyIdParam } : {}),
  };

  const { data: revData, isLoading: revLoading, refetch: refetchRev } = useQuery({
    queryKey: ["revenueReport", queryParams],
    queryFn: () => reportsApi.revenue(queryParams),
  });

  const { data: occData, isLoading: occLoading, refetch: refetchOcc } = useQuery({
    queryKey: ["occupancyReport", queryParams],
    queryFn: () => reportsApi.occupancy(queryParams),
  });

  const { data: payData, isLoading: payLoading, refetch: refetchPay } = useQuery({
    queryKey: ["paymentsReport", queryParams],
    queryFn: () => reportsApi.payments(queryParams),
  });

  const rev = revData?.data?.data || {};
  const occ = occData?.data?.data || {};
  const pay = payData?.data?.data || {};

  const totalRev = Number(rev.total_revenue || 0);
  const todayRev = Number(rev.today_revenue || 0);
  const monthRev = Number(rev.month_revenue || 0);
  const roomRev = Number(rev.room_revenue || 0);
  const serviceRev = Number(rev.service_revenue || 0);
  const adr = Number(rev.adr || 0);
  const revpar = Number(rev.revpar || 0);

  const occRate = Number(occ.occupancy_rate || 0);
  const totalRooms = Number(occ.total_rooms || 0);
  const occupiedRooms = Number(occ.occupied_rooms || 0);
  const availableRooms = Number(occ.available_rooms || 0);
  const cleaningRooms = Number(occ.cleaning_rooms || 0);
  const maintenanceRooms = Number(occ.maintenance_rooms || 0);
  const reservedRooms = Number(occ.reserved_rooms || 0);

  const paymentsByMethod: Record<string, number> = rev.payments_by_method || {};
  const recentTx: any[] = rev.recent_transactions || [];
  const paymentBreakdown = pay.breakdown || [];

  const handleRefresh = () => {
    refetchRev();
    refetchOcc();
    refetchPay();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Manager Analytics & Financials {selectedProperty ? `— ${selectedProperty.name}` : "— All Properties"}
          </h1>
          <p className="text-sm text-slate-500">
            Real-time revenue performance, room inventory occupancy, ADR, RevPAR, and audit transactions {selectedProperty ? `for ${selectedProperty.name}` : "across all properties"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector */}
          <div className="bg-white border border-slate-200 rounded-lg p-1 flex items-center shadow-sm">
            {(["TODAY", "7D", "30D", "MONTH"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  period === p
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p === "TODAY" ? "Today" : p === "7D" ? "7 Days" : p === "30D" ? "30 Days" : "This Month"}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 shadow-sm"
            title="Refresh analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            Rs. {totalRev.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>Today: <strong>Rs. {todayRev.toLocaleString()}</strong></span>
            <span>Month: <strong>Rs. {monthRev.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Live Occupancy */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Occupancy Rate</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">
            {occRate}%
          </p>
          <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            {occupiedRooms} occupied of {totalRooms} total rooms
          </p>
        </div>

        {/* ADR */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Daily Rate (ADR)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-700 mt-2">
            Rs. {adr > 0 ? Math.round(adr).toLocaleString() : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            Average revenue per occupied room
          </p>
        </div>

        {/* RevPAR */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">RevPAR</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            Rs. {revpar > 0 ? Math.round(revpar).toLocaleString() : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            Revenue per available inventory room
          </p>
        </div>
      </div>

      {/* Middle Row: Inventory Breakdown & Revenue Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Inventory Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-blue-600" />
            <span>Room Inventory Status</span>
          </h3>

          {/* Visual Bar */}
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
            {totalRooms > 0 && (
              <>
                <div style={{ width: `${(occupiedRooms / totalRooms) * 100}%` }} className="bg-rose-500 h-full" title="Occupied" />
                <div style={{ width: `${(availableRooms / totalRooms) * 100}%` }} className="bg-emerald-500 h-full" title="Available" />
                <div style={{ width: `${(cleaningRooms / totalRooms) * 100}%` }} className="bg-amber-400 h-full" title="Cleaning" />
                <div style={{ width: `${(reservedRooms / totalRooms) * 100}%` }} className="bg-blue-500 h-full" title="Reserved" />
              </>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-center">
              <span className="text-lg font-bold text-rose-700 block">{occupiedRooms}</span>
              <span className="text-[11px] font-semibold text-rose-600 uppercase">Occupied</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
              <span className="text-lg font-bold text-emerald-700 block">{availableRooms}</span>
              <span className="text-[11px] font-semibold text-emerald-600 uppercase">Available</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-center">
              <span className="text-lg font-bold text-blue-700 block">{reservedRooms}</span>
              <span className="text-[11px] font-semibold text-blue-600 uppercase">Reserved</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-center">
              <span className="text-lg font-bold text-amber-700 block">{cleaningRooms}</span>
              <span className="text-[11px] font-semibold text-amber-600 uppercase">Cleaning</span>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100 text-center">
              <span className="text-lg font-bold text-orange-700 block">{maintenanceRooms}</span>
              <span className="text-[11px] font-semibold text-orange-600 uppercase">Repair</span>
            </div>
          </div>
        </div>

        {/* Revenue Streams & Payment Channels */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            <span>Revenue Composition & Channels</span>
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <BedDouble className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Room Stay Revenue</span>
                  <span className="text-xs text-slate-500">Direct bookings & overnight stays</span>
                </div>
              </div>
              <span className="text-base font-bold text-slate-900">Rs. {roomRev.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Services & F&B Charges</span>
                  <span className="text-xs text-slate-500">Dining, mini-bar, laundry & add-ons</span>
                </div>
              </div>
              <span className="text-base font-bold text-slate-900">Rs. {serviceRev.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Transactions Feed */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900">Latest Collected Transactions</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">{recentTx.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Guest</th>
                <th className="px-6 py-3 font-semibold">Room</th>
                <th className="px-6 py-3 font-semibold">Payment Channel</th>
                <th className="px-6 py-3 font-semibold">Reference</th>
                <th className="px-6 py-3 font-semibold">Date & Time</th>
                <th className="px-6 py-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTx.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No recent transaction records found for this period.
                  </td>
                </tr>
              ) : (
                recentTx.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{tx.guest_name || "Guest"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-medium">Room {tx.room_number || "—"}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {tx.payment_method?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-slate-500">{tx.reference || "—"}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      {new Date(tx.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-emerald-600">
                      +Rs. {Number(tx.amount).toLocaleString()}
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
