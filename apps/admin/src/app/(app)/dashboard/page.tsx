"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { BedDouble, Users, Wrench, TrendingUp, ArrowUpRight, Clock, CheckCircle, AlertCircle } from "lucide-react";
import clsx from "clsx";

function StatCard({
  title, value, icon: Icon, color, subtitle,
}: {
  title: string; value: string | number; icon: any; color: string; subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={clsx("p-2 rounded-lg", color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function RoomStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    AVAILABLE: { label: "Available", className: "status-available" },
    OCCUPIED: { label: "Occupied", className: "status-occupied" },
    RESERVED: { label: "Reserved", className: "status-reserved" },
    CLEANING: { label: "Cleaning", className: "status-cleaning" },
    MAINTENANCE: { label: "Maintenance", className: "status-maintenance" },
    OUT_OF_SERVICE: { label: "Out of Service", className: "status-out_of_service" },
  };
  const config = configs[status] || { label: status, className: "" };
  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}

import { useActiveProperty } from "@/hooks/useActiveProperty";

export default function DashboardPage() {
  const { propertyIdParam, selectedProperty, isAll } = useActiveProperty();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", propertyIdParam],
    queryFn: () => reportsApi.dashboard(propertyIdParam),
    refetchInterval: 60_000, // refresh every minute
  });

  const stats = data?.data?.data;
  const roomStatus = stats?.room_status || {};

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl h-28 border border-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard {selectedProperty ? `— ${selectedProperty.name}` : "— All Properties"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {!isAll && selectedProperty?.city && ` • ${selectedProperty.city}`}
        </p>
      </div>

      {/* Room Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { key: "AVAILABLE", label: "Available", icon: CheckCircle, color: "bg-emerald-50 text-emerald-600" },
          { key: "OCCUPIED", label: "Occupied", icon: Users, color: "bg-red-50 text-red-600" },
          { key: "RESERVED", label: "Reserved", icon: Clock, color: "bg-blue-50 text-blue-600" },
          { key: "CLEANING", label: "Cleaning", icon: Wrench, color: "bg-amber-50 text-amber-600" },
          { key: "MAINTENANCE", label: "Maintenance", icon: AlertCircle, color: "bg-orange-50 text-orange-600" },
        ].map(({ key, label, icon, color }) => (
          <StatCard
            key={key}
            title={label}
            value={roomStatus[key] || 0}
            icon={icon}
            color={color}
            subtitle="rooms"
          />
        ))}
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Today's Check-ins"
          value={stats?.todays_check_ins || 0}
          icon={ArrowUpRight}
          color="bg-blue-50 text-blue-600"
          subtitle="check-ins today"
        />
        <StatCard
          title="Today's Check-outs"
          value={stats?.todays_check_outs || 0}
          icon={BedDouble}
          color="bg-slate-50 text-slate-600"
          subtitle="check-outs today"
        />
        <StatCard
          title="Today's Revenue"
          value={`LKR ${(stats?.todays_revenue || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600"
          subtitle="from completed checkouts"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/check-in"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            + New Check-in
          </Link>
          <Link
            href="/bookings"
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors inline-block"
          >
            Manage Bookings
          </Link>
          <Link
            href="/guests"
            className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors inline-block"
          >
            Guests Directory
          </Link>
          <Link
            href="/housekeeping"
            className="px-4 py-2 border border-amber-200 text-amber-700 bg-amber-50 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors inline-block"
          >
            Housekeeping
          </Link>
        </div>
      </div>

      {/* Room Status Grid placeholder */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Room Status</h2>
          <a href="/rooms" className="text-sm text-blue-600 hover:text-blue-700">View all →</a>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(roomStatus).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              <RoomStatusBadge status={status} />
              <span className="text-sm font-semibold text-slate-700">{count as number}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
