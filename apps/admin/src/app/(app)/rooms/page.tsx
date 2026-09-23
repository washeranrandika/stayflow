"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, roomsApi, roomTypesApi } from "@/lib/api";
import { Users, AirVent, Loader2, BedDouble, Plus, X, CheckCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import clsx from "clsx";

function RoomStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    AVAILABLE: { label: "Available", className: "status-available" },
    OCCUPIED: { label: "Occupied", className: "status-occupied" },
    RESERVED: { label: "Reserved", className: "status-reserved" },
    CLEANING: { label: "Cleaning", className: "status-cleaning" },
    MAINTENANCE: { label: "Maintenance", className: "status-maintenance" },
    OUT_OF_SERVICE: { label: "Out of Service", className: "status-out_of_service" },
  };
  const config = configs[status] || { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <span className={clsx("px-2.5 py-1 rounded-md text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [roomNumber, setRoomNumber] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [floor, setFloor] = useState("1");
  const [maxGuests, setMaxGuests] = useState(2);
  const [notes, setNotes] = useState("");

  // 1. Fetch properties (to get the active property ID)
  const { data: propsData, isLoading: isLoadingProps } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const propertyId = propsData?.data?.data?.[0]?.id;

  // 2. Fetch rooms for that property
  const { data: roomsData, isLoading: isLoadingRooms } = useQuery({
    queryKey: ["rooms", propertyId],
    queryFn: () => roomsApi.listByProperty(propertyId as string),
    enabled: !!propertyId,
  });

  // 3. Fetch room types for creation dropdown
  const { data: typesData } = useQuery({
    queryKey: ["roomTypes", propertyId],
    queryFn: () => roomTypesApi.listByProperty(propertyId as string),
    enabled: !!propertyId,
  });

  const roomTypes = typesData?.data?.data || [];
  const rooms = roomsData?.data?.data || [];
  const filteredRooms = filter ? rooms.filter((r: any) => r.status === filter) : rooms;

  // Set default room type when available
  if (roomTypes.length > 0 && !roomTypeId) {
    setRoomTypeId(roomTypes[0].id);
  }

  // Create Room Mutation
  const createMutation = useMutation({
    mutationFn: (body: any) => roomsApi.create(body),
    onSuccess: () => {
      toast.success("Room created successfully!");
      queryClient.invalidateQueries({ queryKey: ["rooms", propertyId] });
      setIsModalOpen(false);
      setRoomNumber("");
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail?.message || "Failed to create room");
    },
  });

  // Status Change Mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      roomsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success("Room status updated");
      queryClient.invalidateQueries({ queryKey: ["rooms", propertyId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail?.message || "Failed to update room");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !roomTypeId || !propertyId) {
      toast.error("Please fill in the room number and select a room type.");
      return;
    }

    createMutation.mutate({
      property_id: propertyId,
      room_type_id: roomTypeId,
      room_number: roomNumber.trim(),
      floor: floor.trim() || null,
      max_guests: Number(maxGuests) || 2,
      notes: notes.trim() || null,
    });
  };

  const filters = [
    { label: "All Rooms", value: null },
    { label: "Available", value: "AVAILABLE" },
    { label: "Occupied", value: "OCCUPIED" },
    { label: "Reserved", value: "RESERVED" },
    { label: "Cleaning", value: "CLEANING" },
    { label: "Maintenance", value: "MAINTENANCE" },
  ];

  if (isLoadingProps || isLoadingRooms) {
    return (
      <div className="p-8 flex justify-center items-center h-[calc(100vh-64px)]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-800">No properties found</h2>
        <p className="text-slate-500 mt-2">Please create a property first.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rooms</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and monitor room status across your property</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Room
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 mb-6">
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

      {/* Grid */}
      {filteredRooms.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
          <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No rooms found matching this status.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 px-4 py-2 text-sm bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100"
          >
            + Create your first room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room: any) => (
            <div key={room.id} className="bg-white rounded-xl border border-slate-200 p-5 card-hover flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Room {room.room_number}</h3>
                    {room.floor && <p className="text-xs text-slate-500">Floor {room.floor}</p>}
                  </div>
                  <RoomStatusBadge status={room.status} />
                </div>
                
                <p className="text-sm font-semibold text-slate-700 mb-3">{room.room_type?.name || "Standard"}</p>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium">{room.max_guests} Guests</span>
                  </div>
                  {room.room_type?.is_ac && (
                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs font-medium">
                      <AirVent className="w-3.5 h-3.5" />
                      <span>AC</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action strip at bottom */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {room.notes || "Ready for guests"}
                </span>
                <div className="flex gap-2">
                   {room.status === "CLEANING" && (
                     <button
                       onClick={() => statusMutation.mutate({ id: room.id, status: "AVAILABLE" })}
                       className="text-xs px-3 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-md hover:bg-emerald-100 transition-colors border border-emerald-200"
                     >
                       Mark Clean
                     </button>
                   )}
                   {room.status === "AVAILABLE" && (
                     <button
                       onClick={() => router.push("/check-in")}
                       className="text-xs px-3 py-1 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                     >
                       Check-in
                     </button>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE ROOM MODAL ────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <BedDouble className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Add New Room</h2>
                  <p className="text-xs text-slate-500">Create a room under the active property</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              {/* Room Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Room Number / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 101, Villa 2, Suite A"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Room Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Room Type *
                </label>
                {roomTypes.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    No room types found. Please go to <a href="/room-types" className="underline font-bold">Room Types</a> first.
                  </div>
                ) : (
                  <select
                    value={roomTypeId}
                    onChange={(e) => setRoomTypeId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {roomTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Max {t.max_guests} Guests) - LKR {t.base_nightly_rate}/night
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Floor & Max Guests */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Floor (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1, 2, Ground"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Max Capacity (Guests)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxGuests}
                    onChange={(e) => setMaxGuests(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Internal Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Garden view, king bed, pool side"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || roomTypes.length === 0}
                  className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
