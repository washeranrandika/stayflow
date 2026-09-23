"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, propertiesApi } from "@/lib/api";
import { BarChart3, TrendingUp, Calendar, CreditCard, DollarSign, BedDouble } from "lucide-react";

export default function ReportsPage() {
  const [propertyId, setPropertyId] = useState<string>("all");
  const [reportType, setReportType] = useState<"revenue" | "occupancy" | "payments">("revenue");

  const { data: propsData } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ["revenueReport", propertyId],
    queryFn: () => reportsApi.revenue(propertyId !== "all" ? { property_id: propertyId } : {}),
    enabled: reportType === "revenue",
  });

  const { data: occData, isLoading: occLoading } = useQuery({
    queryKey: ["occupancyReport", propertyId],
    queryFn: () => reportsApi.occupancy(propertyId !== "all" ? { property_id: propertyId } : {}),
    enabled: reportType === "occupancy",
  });

  const { data: payData, isLoading: payLoading } = useQuery({
    queryKey: ["paymentsReport", propertyId],
    queryFn: () => reportsApi.payments(propertyId !== "all" ? { property_id: propertyId } : {}),
    enabled: reportType === "payments",
  });

  const properties = propsData?.data?.data || [];
  const revenueStats = revData?.data?.data || {};
  const occupancyStats = occData?.data?.data || {};
  const paymentStats = payData?.data?.data?.breakdown || (Array.isArray(payData?.data?.data) ? payData.data.data : []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-sm text-slate-500">
            Performance metrics, revenue breakdowns, and property occupancy statistics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Properties</option>
            {properties.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setReportType("revenue")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            reportType === "revenue"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Revenue Report
        </button>
        <button
          onClick={() => setReportType("occupancy")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            reportType === "occupancy"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Occupancy Rate
        </button>
        <button
          onClick={() => setReportType("payments")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            reportType === "payments"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Payment Methods
        </button>
      </div>

      {/* Revenue View */}
      {reportType === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Today's Revenue</span>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                Rs. {Number(revenueStats.today_revenue || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">This Month</span>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                Rs. {Number(revenueStats.month_revenue || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Total All-Time</span>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                Rs. {Number(revenueStats.total_revenue || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Occupancy View */}
      {reportType === "occupancy" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">Current Occupancy</h3>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full border-8 border-blue-600 flex items-center justify-center font-bold text-xl text-slate-900">
                {occupancyStats.occupancy_rate || 0}%
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p><strong>{occupancyStats.occupied_rooms || 0}</strong> rooms currently occupied</p>
                <p><strong>{occupancyStats.available_rooms || 0}</strong> rooms available</p>
                <p><strong>{occupancyStats.total_rooms || 0}</strong> total rooms in inventory</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods View */}
      {reportType === "payments" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4">Payment Method Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {Array.isArray(paymentStats) && paymentStats.map((pm: any) => (
              <div key={pm.method} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500">{pm.method}</span>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  Rs. {Number(pm.total || 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 mt-1">{pm.count || 0} transaction(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
