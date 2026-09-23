"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookingsApi } from "@/lib/api";
import { Loader2, Calendar as CalendarIcon, FileText, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import clsx from "clsx";

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    CONFIRMED: { label: "Confirmed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
    CHECKED_IN: { label: "Checked In", className: "bg-blue-50 text-blue-700 border-blue-200" },
    COMPLETED: { label: "Completed", className: "bg-slate-100 text-slate-700 border-slate-200" },
    CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const config = configs[status] || { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <span className={clsx("px-2.5 py-1 rounded-md text-xs font-semibold border", config.className)}>
      {config.label}
    </span>
  );
}

import { useActiveProperty } from "@/hooks/useActiveProperty";
import { Building2 } from "lucide-react";

export default function BookingsPage() {
  const { propertyIdParam, selectedProperty, properties, setProperty, selectedPropertyId } = useActiveProperty();
  const [filter, setFilter] = useState<string | null>(null);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["bookings", filter, propertyIdParam],
    queryFn: () =>
      bookingsApi.list({
        ...(filter ? { status: filter } : {}),
        ...(propertyIdParam ? { property_id: propertyIdParam } : {}),
      }),
  });

  const bookings = bookingsData?.data?.data || [];

  const filters = [
    { label: "All Bookings", value: null },
    { label: "Pending", value: "PENDING" },
    { label: "Confirmed", value: "CONFIRMED" },
    { label: "Checked In", value: "CHECKED_IN" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Cancelled", value: "CANCELLED" },
  ];

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-[calc(100vh-64px)]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bookings {selectedProperty ? `— ${selectedProperty.name}` : ""}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage reservations and active stays across your properties</p>
        </div>
        <div className="flex items-center gap-3">
          {properties.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Property:</span>
              <select
                value={selectedPropertyId}
                onChange={(e) => setProperty(e.target.value)}
                className="text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-2"
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            + New Booking
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2">
          {filters.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                filter === f.value
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or #"
            className="pl-9 pr-4 py-2 w-full sm:w-64 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Reservation #</th>
                <th className="px-6 py-4 font-medium">Guest Name</th>
                <th className="px-6 py-4 font-medium">Room</th>
                <th className="px-6 py-4 font-medium">Dates</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No bookings found</p>
                  </td>
                </tr>
              ) : (
                bookings.map((booking: any) => (
                  <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900">{booking.reservation_number}</span>
                      <div className="text-xs text-slate-500 mt-1 capitalize">{booking.stay_type?.toLowerCase()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{booking.primary_guest?.full_name}</span>
                      <div className="text-xs text-slate-500 mt-1">{booking.primary_guest?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      {booking.room ? (
                        <span className="font-medium text-slate-900">Room {booking.room.room_number}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-700">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {format(parseISO(booking.check_in_date), "MMM d")} - {format(parseISO(booking.expected_checkout_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 font-medium hover:text-blue-700">View</button>
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
