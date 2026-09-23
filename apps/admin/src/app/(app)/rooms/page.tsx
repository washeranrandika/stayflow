"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, roomsApi, roomTypesApi } from "@/lib/api";
import { Users, AirVent, Loader2, BedDouble, Plus, X, Building2, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [propertyId, setPropertyId] = useState<string>("");

  // Form State
  const [roomNumber, setRoomNumber] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [floor, setFloor] = useState("1");
  const [maxGuests, setMaxGuests] = useState(2);
  const [notes, setNotes] = useState("");

  // 1. Fetch properties
  const { data: propsData, isLoading: isLoadingProps } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const properties = propsData?.data?.data || [];

  // Sync selected property from URL query, localStorage, or first property
  useEffect(() => {
    const urlPropId = searchParams.get("property_id");
    if (urlPropId) {
      setPropertyId(urlPropId);
      localStorage.setItem("sf_selected_property", urlPropId);
      return;
    }

    if (properties.length > 0 && !propertyId) {
      const saved = localStorage.getItem("sf_selected_property");
      if (saved && saved !== "all" && properties.some((p: any) => p.id === saved)) {
        setPropertyId(saved);
      } else {
        setPropertyId(properties[0].id);
      }
    }
  }, [searchParams, properties, propertyId]);

  // Listen to header property change events
  useEffect(() => {
    const handlePropChanged = (e: any) => {
      const newId = e.detail;
      if (newId && newId !== "all") {
        setPropertyId(newId);
      } else if (newId === "all" && properties.length > 0) {
        setPropertyId(properties[0].id);
      }
    };
    window.addEventListener("property-changed", handlePropChanged);
    return () => window.removeEventListener("property-changed", handlePropChanged);
  }, [properties]);

  const handlePropertyChange = (newPropId: string) => {
    setPropertyId(newPropId);
    localStorage.setItem("sf_selected_property", newPropId);
    window.dispatchEvent(new CustomEvent("property-changed", { detail: newPropId }));
    router.replace(`/rooms?property_id=${newPropId}`);
  };

  // 2. Fetch rooms for active property
  const { data: roomsData, isLoading: isLoadingRooms } = useQuery({
    queryKey: ["rooms", propertyId],
    queryFn: () => roomsApi.listByProperty(propertyId as string),
    enabled: !!propertyId,
  });

  // 3. Fetch room types for active property
  const { data: typesData } = useQuery({
    queryKey: ["roomTypes", propertyId],
    queryFn: () => roomTypesApi.listByProperty(propertyId as string),
    enabled: !!propertyId,
  });

  const roomTypes = typesData?.data?.data || [];
  const rooms = roomsData?.data?.data || [];
  const filteredRooms = filter ? rooms.filter((r: any) => r.status === filter) : rooms;
  const currentProperty = properties.find((p: any) => p.id === propertyId);

  // Set default room type when available or changed
  useEffect(() => {
    if (roomTypes.length > 0) {
      setRoomTypeId(roomTypes[0].id);
    } else {
      setRoomTypeId("");
    }
  }, [propertyId, typesData]);

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

  if (isLoadingProps) {
    return (
      <div className="p-8 flex justify-center items-center h-[calc(100vh-64px)]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200 m-6">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">No properties found</h2>
        <p className="text-slate-500 text-sm mt-1">Please create a property first.</p>
        <button
          onClick={() => router.push("/properties")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Go to Properties
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Property Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Grid & Status</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage room inventory and housekeeping status for {currentProperty?.name || "your property"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Property Dropdown Selector */}
          <div className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs text-slate-500 font-medium">Property:</span>
            <select
              value={propertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-2"
            >
              {properties.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Room
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1">
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

      {/* Loading state for rooms */}
      {isLoadingRooms ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
          <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            {filter ? "No rooms match the selected filter" : `No rooms added yet for ${currentProperty?.name || "this property"}`}
          </h3>
          <p className="text-slate-500 text-xs mt-1">
            {roomTypes.length === 0
              ? "Create a room type first, then add rooms to this property."
              : "Get started by adding your first room to this property."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {roomTypes.length === 0 ? (
              <button
                onClick={() => router.push(`/room-types?property_id=${propertyId}`)}
                className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                + Create Room Type First
              </button>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                + Add Room to {currentProperty?.name || "Property"}
              </button>
            )}
          </div>
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
                <span className="text-xs text-slate-400 font-medium truncate max-w-[120px]">
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
                       onClick={() => router.push(`/check-in?property_id=${propertyId}`)}
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
                  <p className="text-xs text-slate-500">
                    Adding to <span className="font-semibold text-blue-600">{currentProperty?.name}</span>
                  </p>
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
              {/* Property Indicator / Switcher in Modal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Property
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {properties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.city ? `(${p.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

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
                    No room types found for {currentProperty?.name}. Please create a{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        router.push(`/room-types?property_id=${propertyId}`);
                      }}
                      className="underline font-bold text-amber-900 hover:text-amber-950"
                    >
                      Room Type
                    </button>{" "}
                    first.
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
