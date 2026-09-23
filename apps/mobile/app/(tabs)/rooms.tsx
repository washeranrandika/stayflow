import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Users, AirVent, Maximize } from "lucide-react-native";

export default function RoomsScreen() {
  const [filter, setFilter] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rooms", user?.organization_id],
    queryFn: async () => {
      // First get properties
      const propsRes = await api.get("/properties");
      const props = propsRes.data.data;
      if (props.length === 0) return [];
      
      // Get rooms for first property
      const roomsRes = await api.get(`/rooms/by-property/${props[0].id}`);
      return roomsRes.data.data;
    },
    enabled: !!user?.organization_id,
  });

  const rooms = data || [];
  const filteredRooms = filter ? rooms.filter((r: any) => r.status === filter) : rooms;

  const renderRoom = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.roomCard}>
      <View style={styles.roomHeader}>
        <Text style={styles.roomNumber}>Room {item.room_number}</Text>
        <View style={[styles.badge, getStatusStyle(item.status)]}>
          <Text style={[styles.badgeText, getStatusTextStyle(item.status)]}>
            {item.status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <Text style={styles.roomType}>{item.room_type?.name}</Text>
      
      <View style={styles.features}>
        <View style={styles.feature}>
          <Users size={14} color="#64748b" />
          <Text style={styles.featureText}>Up to {item.max_guests}</Text>
        </View>
        {item.room_type?.is_ac && (
          <View style={styles.feature}>
            <AirVent size={14} color="#64748b" />
            <Text style={styles.featureText}>AC</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <FilterChip label="All" active={filter === null} onPress={() => setFilter(null)} />
          <FilterChip label="Available" active={filter === "AVAILABLE"} onPress={() => setFilter("AVAILABLE")} />
          <FilterChip label="Occupied" active={filter === "OCCUPIED"} onPress={() => setFilter("OCCUPIED")} />
          <FilterChip label="Cleaning" active={filter === "CLEANING"} onPress={() => setFilter("CLEANING")} />
          <FilterChip label="Reserved" active={filter === "RESERVED"} onPress={() => setFilter("RESERVED")} />
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No rooms found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// Keep FilterChip in same file for simplicity
import { ScrollView } from "react-native";
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity 
      style={[styles.chip, active && styles.chipActive]} 
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case "AVAILABLE": return { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" };
    case "OCCUPIED": return { backgroundColor: "#fef2f2", borderColor: "#fecaca" };
    case "RESERVED": return { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" };
    case "CLEANING": return { backgroundColor: "#fffbeb", borderColor: "#fde68a" };
    default: return { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" };
  }
}

function getStatusTextStyle(status: string) {
  switch (status) {
    case "AVAILABLE": return { color: "#166534" };
    case "OCCUPIED": return { color: "#991b1b" };
    case "RESERVED": return { color: "#1e40af" };
    case "CLEANING": return { color: "#92400e" };
    default: return { color: "#475569" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  filters: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { 
    paddingHorizontal: 16, paddingVertical: 8, 
    borderRadius: 20, backgroundColor: "#f1f5f9",
  },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#fff" },
  list: { padding: 16, gap: 12 },
  roomCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  roomHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  roomNumber: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  roomType: { fontSize: 14, color: "#475569", marginBottom: 12 },
  features: { flexDirection: "row", gap: 16 },
  feature: { flexDirection: "row", alignItems: "center", gap: 4 },
  featureText: { fontSize: 13, color: "#64748b" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#94a3b8" },
});
