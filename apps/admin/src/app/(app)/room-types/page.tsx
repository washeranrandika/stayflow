"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roomTypesApi, propertiesApi } from "@/lib/api";
import { Layers, Plus, DollarSign, Wind, Users, Check, Sparkles } from "lucide-react";

export default function RoomTypesPage() {
  const queryClient = useQueryClient();
  const [propertyId, setPropertyId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isAc, setIsAc] = useState(true);
  const [maxGuests, setMaxGuests] = useState(2);
  const [hourlyRate, setHourlyRate] = useState(1000);
  const [dayUseRate, setDayUseRate] = useState(3000);
  const [nightlyRate, setNightlyRate] = useState(5000);
  const [dailyRate, setDailyRate] = useState(5000);
  const [extraHourRate, setExtraHourRate] = useState(500);

  const { data: propsData } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const properties = propsData?.data?.data || [];

  useEffect(() => {
    if (properties.length > 0 && !propertyId) {
      const saved = localStorage.getItem("sf_selected_property");
      if (saved && saved !== "all") {
        setPropertyId(saved);
      } else {
        setPropertyId(properties[0].id);
      }
    }
  }, [properties, propertyId]);

  const { data: typesData, isLoading } = useQuery({
    queryKey: ["roomTypes", propertyId],
    queryFn: () => roomTypesApi.listByProperty(propertyId),
    enabled: !!propertyId,
  });

  const roomTypes = typesData?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => roomTypesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roomTypes", propertyId] });
      setIsModalOpen(false);
      setName("");
      setDescription("");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !propertyId) return;
    createMutation.mutate({
      property_id: propertyId,
      name,
      description,
      is_ac: isAc,
      max_guests: Number(maxGuests),
      base_hourly_rate: Number(hourlyRate),
      base_day_use_rate: Number(dayUseRate),
      base_nightly_rate: Number(nightlyRate),
      base_daily_rate: Number(dailyRate),
      extra_hour_rate: Number(extraHourRate),
      extra_guest_rate: 500,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Types & Rates</h1>
          <p className="text-sm text-slate-500">Configure base rates for hourly, day-use, overnight and daily stays.</p>
        </div>
        <div className="flex items-center gap-3">
          {properties.length > 1 && (
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {properties.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Room Type</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
      ) : roomTypes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No room types configured</h3>
          <p className="text-sm text-slate-500 mt-1">Define standard rates for this property.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roomTypes.map((rt: any) => (
            <div
              key={rt.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                    <Wind className="w-3 h-3" />
                    <span>{rt.is_ac ? "Air Conditioned" : "Non-AC"}</span>
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>Up to {rt.max_guests} guests</span>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-3">{rt.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rt.description || "No description provided."}</p>

                {/* Rate Tiers */}
                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-xs text-slate-500">Hourly Rate</span>
                    <span className="font-bold text-slate-900">Rs. {Number(rt.base_hourly_rate).toLocaleString()} / hr</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-xs text-slate-500">Day Use (10am-6pm)</span>
                    <span className="font-bold text-slate-900">Rs. {Number(rt.base_day_use_rate).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-xs text-slate-500">Overnight (Standard)</span>
                    <span className="font-bold text-blue-600">Rs. {Number(rt.base_nightly_rate).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-xs text-slate-500">Extra Hour Overtime</span>
                    <span className="text-xs font-semibold text-slate-700">Rs. {Number(rt.extra_hour_rate).toLocaleString()} / hr</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create Room Type</h2>
            <p className="text-sm text-slate-500 mb-4">Set up room specifications and multi-tier pricing models.</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Room Type Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deluxe King Suite"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">AC Specification</label>
                  <select
                    value={isAc ? "true" : "false"}
                    onChange={(e) => setIsAc(e.target.value === "true")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Air Conditioned (AC)</option>
                    <option value="false">Non-AC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Guests</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxGuests}
                    onChange={(e) => setMaxGuests(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base Hourly Rate (Rs.)</label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Day-Use Rate (Rs.)</label>
                  <input
                    type="number"
                    value={dayUseRate}
                    onChange={(e) => setDayUseRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nightly Rate (Rs.)</label>
                  <input
                    type="number"
                    value={nightlyRate}
                    onChange={(e) => setNightlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Extra Hour Rate (Rs.)</label>
                  <input
                    type="number"
                    value={extraHourRate}
                    onChange={(e) => setExtraHourRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Save Room Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
