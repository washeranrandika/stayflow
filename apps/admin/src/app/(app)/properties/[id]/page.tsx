"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, roomsApi, roomTypesApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Building2, MapPin, Clock, ArrowLeft, BedDouble, Layers, Plus, Edit2 } from "lucide-react";
import Link from "next/link";

export default function PropertyDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const { data: propData, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => propertiesApi.get(id),
  });

  const { data: roomsData } = useQuery({
    queryKey: ["rooms", id],
    queryFn: () => roomsApi.listByProperty(id),
    enabled: !!id,
  });

  const { data: typesData } = useQuery({
    queryKey: ["roomTypes", id],
    queryFn: () => roomTypesApi.listByProperty(id),
    enabled: !!id,
  });

  const property = propData?.data?.data;
  const rooms = roomsData?.data?.data || [];
  const roomTypes = typesData?.data?.data || [];

  const updateMutation = useMutation({
    mutationFn: (updated: any) => propertiesApi.update(id, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property", id] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setIsEditOpen(false);
    },
  });

  const handleEditOpen = () => {
    if (property) {
      setName(property.name);
      setAddress(property.address || "");
      setCity(property.city || "");
      setIsEditOpen(true);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name, address, city });
  };

  if (isLoading) {
    return <div className="p-8 animate-pulse text-slate-500">Loading property details...</div>;
  }

  if (!property) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Property not found.</p>
        <Link href="/properties" className="text-blue-600 font-semibold mt-2 inline-block">
          Back to properties
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/properties"
          className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{property.name}</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>{property.address ? `${property.address}, ${property.city}` : property.city || "No address"}</span>
            <span>•</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{property.timezone}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleEditOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit Property</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Total Rooms</span>
            <BedDouble className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{rooms.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Room Types</span>
            <Layers className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{roomTypes.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">Active Status</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="text-base font-semibold text-slate-900">Operational</p>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Rooms at {property.name}</h2>
          <Link
            href="/rooms"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Manage in Room Grid →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Room Number</th>
                <th className="px-4 py-3">Room Type</th>
                <th className="px-4 py-3">Floor</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map((room: any) => (
                <tr key={room.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-bold text-slate-900">{room.room_number}</td>
                  <td className="px-4 py-3">{room.room_type?.name || "Standard"}</td>
                  <td className="px-4 py-3">{room.floor || 1}</td>
                  <td className="px-4 py-3">{room.max_guests} Guests</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {room.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No rooms configured for this property yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Property Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Edit Property</h2>
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
