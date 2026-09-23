/**
 * StayFlow Mobile – Bookings / Reservations Screen
 * Lists reservations with actions: View detail, Check-in from reservation.
 */
import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "expo-router";
import { Calendar as CalendarIcon, User as UserIcon, BedDouble, X, LogIn } from "lucide-react-native";

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  CONFIRMED:   { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  PENDING:     { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  CHECKED_IN:  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  COMPLETED:   { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" },
  CANCELLED:   { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  NO_SHOW:     { bg: "#fdf4ff", border: "#e9d5ff", text: "#7e22ce" },
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function BookingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState("ALL");

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["reservations", filter],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (filter !== "ALL") params.status = filter;
      const res = await api.get("/bookings", { params });
      return res.data.data;
    },
  });

  const getErrorMessage = (err: any) => {
    if (!err) return null;
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (err.message) return err.message;
    return "Failed to load bookings.";
  };

  const checkInMutation = useMutation({
    mutationFn: (reservationId: string) =>
      api.post("/stays/check-in", {
        reservation_id: reservationId,
        property_id: selected?.property_id,
        room_id: selected?.room_id,
        primary_guest_id: selected?.primary_guest_id,
        stay_type: "OVERNIGHT",
        num_guests: selected?.num_guests || 1,
        expected_checkout: selected?.expected_checkout_date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setSelected(null);
      Alert.alert("✅ Checked In", "Guest has been successfully checked in.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.error?.message || "Check-in failed");
    },
  });

  const bookings: any[] = data?.items ?? data ?? [];
  const filteredBookings = bookings;

  const renderBooking = ({ item }: { item: any }) => {
    const s = STATUS_STYLES[item.status] ?? STATUS_STYLES["PENDING"];
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.resNumber}>#{item.reservation_number || item.id?.slice(0, 8)}</Text>
          <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
            <Text style={[styles.badgeText, { color: s.text }]}>{item.status?.replace("_", " ")}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <UserIcon size={15} color="#64748b" />
            <Text style={styles.detailText}>{item.primary_guest?.full_name ?? "Guest"}</Text>
          </View>
          <View style={styles.detailRow}>
            <CalendarIcon size={15} color="#64748b" />
            <Text style={styles.detailText}>
              {fmt(item.check_in_date)} → {fmt(item.expected_checkout_date)}
            </Text>
          </View>
          {item.room && (
            <View style={styles.detailRow}>
              <BedDouble size={15} color="#64748b" />
              <Text style={styles.detailText}>Room {item.room.room_number}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}
        contentContainerStyle={styles.filterContent}>
        {["ALL", "CONFIRMED", "PENDING", "CHECKED_IN", "COMPLETED", "CANCELLED"].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, filter === s && styles.chipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : isError ? (
        <View style={[styles.center, { padding: 24 }]}>
          <View style={{
            backgroundColor: "#fef2f2",
            borderColor: "#fecaca",
            borderWidth: 1,
            borderRadius: 12,
            padding: 18,
            width: "100%",
            alignItems: "center",
          }}>
            <Text style={{ color: "#991b1b", fontWeight: "700", fontSize: 16, marginBottom: 6 }}>
              ⚠️ Unable to Load Bookings
            </Text>
            <Text style={{ color: "#b91c1c", fontSize: 13, textAlign: "center", marginBottom: 14 }}>
              {getErrorMessage(error)}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              style={{
                backgroundColor: "#ef4444",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 13 }}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <CalendarIcon size={32} color="#cbd5e1" />
              <Text style={styles.emptyText}>No reservations found</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reservation #{selected?.reservation_number ?? selected?.id?.slice(0, 8)}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView>
                {/* Guest */}
                <Text style={styles.modalSection}>Guest</Text>
                <Text style={styles.modalValue}>{selected.primary_guest?.full_name}</Text>
                <Text style={styles.modalSub}>{selected.primary_guest?.phone ?? selected.primary_guest?.email}</Text>

                {/* Dates */}
                <Text style={styles.modalSection}>Stay Period</Text>
                <Text style={styles.modalValue}>{fmt(selected.check_in_date)} → {fmt(selected.expected_checkout_date)}</Text>

                {/* Room */}
                {selected.room && (
                  <>
                    <Text style={styles.modalSection}>Room</Text>
                    <Text style={styles.modalValue}>Room {selected.room.room_number}</Text>
                  </>
                )}

                {/* Status */}
                <Text style={styles.modalSection}>Status</Text>
                <View style={[styles.badge, {
                  alignSelf: "flex-start",
                  backgroundColor: (STATUS_STYLES[selected.status] ?? STATUS_STYLES["PENDING"]).bg,
                  borderColor: (STATUS_STYLES[selected.status] ?? STATUS_STYLES["PENDING"]).border,
                }]}>
                  <Text style={[styles.badgeText, {
                    color: (STATUS_STYLES[selected.status] ?? STATUS_STYLES["PENDING"]).text,
                  }]}>{selected.status?.replace("_", " ")}</Text>
                </View>

                {/* Actions */}
                {selected.status === "CONFIRMED" && (
                  <TouchableOpacity
                    style={styles.checkInBtn}
                    onPress={() => checkInMutation.mutate(selected.id)}
                    disabled={checkInMutation.isPending}
                  >
                    {checkInMutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <LogIn size={18} color="#fff" />
                        <Text style={styles.checkInBtnText}>Check-in Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  filterBar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", maxHeight: 52 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f1f5f9" },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#fff" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  resNumber: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  details: { gap: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 14, color: "#475569" },
  empty: { padding: 40, alignItems: "center", gap: 10 },
  emptyText: { color: "#94a3b8", fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: "80%",
  },
  modalHandle: { width: 40, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalSection: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginTop: 16, marginBottom: 4 },
  modalValue: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  modalSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  checkInBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#2563eb", borderRadius: 12,
    padding: 16, marginTop: 24,
  },
  checkInBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
