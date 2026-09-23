"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { guestsApi } from "@/lib/api";
import { Loader2, Search, Users, Mail, Phone, MapPin, AlertTriangle } from "lucide-react";
import clsx from "clsx";

export default function GuestsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Simple debounce effect
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: guestsData, isLoading } = useQuery({
    queryKey: ["guests", debouncedSearch],
    queryFn: () => guestsApi.list(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const guests = guestsData?.data?.data || [];

  if (isLoading && !guestsData) {
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
          <h1 className="text-2xl font-bold text-slate-900">Guests</h1>
          <p className="text-slate-500 text-sm mt-1">Manage guest profiles and history</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          + Add Guest
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex justify-end mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Guest Profile</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Address</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No guests found</p>
                    {search && <p className="text-slate-400 text-sm mt-1">Try adjusting your search</p>}
                  </td>
                </tr>
              ) : (
                guests.map((guest: any) => (
                  <tr key={guest.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          {guest.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 block">{guest.full_name}</span>
                          {guest.blacklisted && (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wide">
                              <AlertTriangle className="w-3 h-3" />
                              Blacklisted
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        {guest.email ? (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{guest.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No email</span>
                        )}
                        {guest.phone ? (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{guest.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No phone</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {guest.address ? (
                        <div className="flex items-start gap-2 text-slate-600 max-w-[200px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="truncate">{guest.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not provided</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 font-medium hover:text-blue-700">View Profile</button>
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
