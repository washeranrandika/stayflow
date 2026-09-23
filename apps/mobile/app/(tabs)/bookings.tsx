import React from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Calendar as CalendarIcon, User as UserIcon, Clock } from "lucide-react-native";
import { format, parseISO } from "date-fns";

export default function BookingsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const res = await api.get("/bookings");
      return res.data.data;
    },
  });

  const bookings = data || [];

  const renderBooking = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.resNumber}>{item.reservation_number}</Text>
        <View style={[styles.badge, getStatusStyle(item.status)]}>
          <Text style={[styles.badgeText, getStatusTextStyle(item.status)]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <UserIcon size={16} color="#64748b" />
          <Text style={styles.detailText}>{item.primary_guest?.full_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <CalendarIcon size={16} color="#64748b" />
          <Text style={styles.detailText}>
            {format(parseISO(item.check_in_date), "MMM d")} - {format(parseISO(item.expected_checkout_date), "MMM d, yyyy")}
          </Text>
        </View>
        {item.room && (
          <View style={styles.detailRow}>
            <Clock size={16} color="#64748b" />
            <Text style={styles.detailText}>Room {item.room.room_number}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case "CONFIRMED": return { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" };
    case "PENDING": return { backgroundColor: "#fffbeb", borderColor: "#fde68a" };
    case "CHECKED_IN": return { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" };
    case "COMPLETED": return { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" };
    case "CANCELLED": return { backgroundColor: "#fef2f2", borderColor: "#fecaca" };
    default: return { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" };
  }
}

function getStatusTextStyle(status: string) {
  switch (status) {
    case "CONFIRMED": return { color: "#166534" };
    case "PENDING": return { color: "#92400e" };
    case "CHECKED_IN": return { color: "#1e40af" };
    case "COMPLETED": return { color: "#475569" };
    case "CANCELLED": return { color: "#991b1b" };
    default: return { color: "#475569" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  resNumber: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  details: { gap: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 14, color: "#475569" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#94a3b8" },
});
