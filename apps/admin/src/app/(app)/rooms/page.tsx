"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi, roomsApi } from "@/lib/api";
import { Users, AirVent, Loader2 } from "lucide-react";
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
  const [filter, setFilter] = useState<string | null>(null);

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

  const rooms = roomsData?.data?.data || [];
  const filteredRooms = filter ? rooms.filter((r: any) => r.status === filter) : rooms;

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
        <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          + Add Room
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
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room: any) => (
            <div key={room.id} className="bg-white rounded-xl border border-slate-200 p-5 card-hover cursor-pointer flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Room {room.room_number}</h3>
                    {room.floor && <p className="text-xs text-slate-500">Floor {room.floor}</p>}
                  </div>
                  <RoomStatusBadge status={room.status} />
                </div>
                
                <p className="text-sm font-medium text-slate-700 mb-4">{room.room_type?.name}</p>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium">{room.max_guests} Guests</span>
                  </div>
                  {room.room_type?.is_ac && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <AirVent className="w-4 h-4" />
                      <span className="text-xs font-medium">AC</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action strip at bottom */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium hover:text-blue-600 transition-colors">
                  View Details
                </span>
                <div className="flex gap-2">
                   {/* Quick status actions based on current status */}
                   {room.status === "CLEANING" && (
                     <button className="text-xs px-3 py-1 bg-amber-50 text-amber-700 font-medium rounded hover:bg-amber-100 transition-colors border border-amber-200">
                       Mark Clean
                     </button>
                   )}
                   {room.status === "AVAILABLE" && (
                     <button className="text-xs px-3 py-1 bg-blue-50 text-blue-700 font-medium rounded hover:bg-blue-100 transition-colors border border-blue-200">
                       Check-in
                     </button>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
