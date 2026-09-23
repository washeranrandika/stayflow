/**
 * StayFlow Mobile – Rooms Screen
 * Lists all rooms with status badges. Tapping opens a bottom-sheet with actions.
 * AVAILABLE → Check-in shortcut
 * OCCUPIED  → View active stay + checkout shortcut
 * CLEANING  → View housekeeping task info
 */
import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, Platform
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, AirVent, LogIn, LogOut, Brush, Info, X } from "lucide-react-native";

const STATUS_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  AVAILABLE:      { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", dot: "#22c55e" },
  OCCUPIED:       { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", dot: "#ef4444" },
  RESERVED:       { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", dot: "#3b82f6" },
  CLEANING:       { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#f59e0b" },
  MAINTENANCE:    { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", dot: "#f97316" },
  OUT_OF_SERVICE: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#94a3b8" },
};

// Filter chips config
const FILTERS = ["ALL", "AVAILABLE", "OCCUPIED", "CLEANING", "RESERVED", "MAINTENANCE"];

export default function RoomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [activeStay, setActiveStay] = useState<any>(null);
  const [loadingStay, setLoadingStay] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["rooms", user?.id],
    queryFn: async () => {
      const propsRes = await api.get("/properties");
      const props = propsRes.data.data;
      if (!props || props.length === 0) return [];
      const roomsRes = await api.get(`/rooms/by-property/${props[0].id}`);
      return roomsRes.data.data;
    },
    enabled: !!user,
  });

  const getErrorMessage = (err: any) => {
    if (!err) return null;
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (err.message) return err.message;
    return "An unexpected error occurred.";
  };

  const rooms: any[] = data || [];
  const filtered = filter === "ALL" ? rooms : rooms.filter((r) => r.status === filter);

  // Count per status for badge numbers
  const counts = rooms.reduce((acc: any, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleRoomPress = async (room: any) => {
    setSelectedRoom(room);
    setActiveStay(null);
    if (room.status === "OCCUPIED") {
      setLoadingStay(true);
      try {
        const res = await api.get("/stays/active");
        const stays: any[] = res.data?.data || [];
        const stay = stays.find((s: any) => s.room_id === room.id || s.room?.id === room.id);
        setActiveStay(stay || null);
      } catch {
        /* non-fatal */
      } finally {
        setLoadingStay(false);
      }
    }
  };

  const renderRoom = ({ item }: { item: any }) => {
    const s = STATUS_MAP[item.status] ?? STATUS_MAP["OUT_OF_SERVICE"];
    return (
      <TouchableOpacity style={styles.roomCard} onPress={() => handleRoomPress(item)} activeOpacity={0.75}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomNumber}>Room {item.room_number}</Text>
          <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
            <View style={[styles.dot, { backgroundColor: s.dot }]} />
            <Text style={[styles.badgeText, { color: s.text }]}>
              {item.status.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        <Text style={styles.roomType}>{item.room_type?.name}</Text>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Users size={13} color="#94a3b8" />
            <Text style={styles.featureText}>Up to {item.max_guests}</Text>
          </View>
          {item.room_type?.is_ac && (
            <View style={styles.feature}>
              <AirVent size={13} color="#94a3b8" />
              <Text style={styles.featureText}>AC</Text>
            </View>
          )}
          <View style={styles.feature}>
            <Text style={styles.featureText}>Rs. {Number(item.room_type?.base_nightly_rate || 0).toLocaleString()}/night</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topBar]}>
        <View>
          <Text style={styles.topBarTitle}>Rooms & Inventory</Text>
          <Text style={styles.topBarSub}>{rooms.length} total rooms registered</Text>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === "ALL" ? `All (${rooms.length})` : `${f.replace(/_/g, " ")} (${counts[f] || 0})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
              ⚠️ Unable to Load Rooms
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
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No rooms match this filter.</Text>
            </View>
          }
        />
      )}

      {/* Room detail bottom-sheet */}
      <Modal visible={!!selectedRoom} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {selectedRoom && (
              <>
                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>Room {selectedRoom.room_number}</Text>
                    <Text style={styles.sheetSub}>{selectedRoom.room_type?.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedRoom(null)}>
                    <X size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Status */}
                <View style={[styles.statusPill, {
                  backgroundColor: (STATUS_MAP[selectedRoom.status] ?? STATUS_MAP["OUT_OF_SERVICE"]).bg,
                  borderColor: (STATUS_MAP[selectedRoom.status] ?? STATUS_MAP["OUT_OF_SERVICE"]).border,
                }]}>
                  <View style={[styles.dot, { backgroundColor: (STATUS_MAP[selectedRoom.status] ?? STATUS_MAP["OUT_OF_SERVICE"]).dot }]} />
                  <Text style={[styles.statusPillText, {
                    color: (STATUS_MAP[selectedRoom.status] ?? STATUS_MAP["OUT_OF_SERVICE"]).text,
                  }]}>{selectedRoom.status.replace(/_/g, " ")}</Text>
                </View>

                {/* Active stay info for OCCUPIED */}
                {selectedRoom.status === "OCCUPIED" && (
                  <View style={styles.stayInfo}>
                    {loadingStay ? (
                      <ActivityIndicator color="#2563eb" />
                    ) : activeStay ? (
                      <>
                        <Text style={styles.stayInfoLabel}>Current Guest</Text>
                        <Text style={styles.stayInfoValue}>{activeStay.primary_guest?.full_name ?? "—"}</Text>
                        <Text style={styles.stayInfoSub}>
                          Checked in: {new Date(activeStay.actual_check_in).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </Text>
                        <Text style={styles.stayInfoSub}>
                          Expected checkout: {new Date(activeStay.expected_checkout).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.stayInfoSub}>No active stay data found.</Text>
                    )}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  {selectedRoom.status === "AVAILABLE" && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        setSelectedRoom(null);
                        router.push("/check-in");
                      }}
                    >
                      <LogIn size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Check-in Guest</Text>
                    </TouchableOpacity>
                  )}

                  {selectedRoom.status === "OCCUPIED" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#0f172a" }]}
                      onPress={() => {
                        setSelectedRoom(null);
                        router.push("/checkout");
                      }}
                    >
                      <LogOut size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Go to Checkout</Text>
                    </TouchableOpacity>
                  )}

                  {selectedRoom.status === "CLEANING" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#b45309" }]}
                      onPress={() => {
                        setSelectedRoom(null);
                        router.push("/housekeeping");
                      }}
                    >
                      <Brush size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>View Housekeeping Tasks</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
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
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  topBarTitle: { fontSize: 19, fontWeight: "900", color: "#0f172a", letterSpacing: -0.3 },
  topBarSub: { fontSize: 11, color: "#64748b", marginTop: 2, fontWeight: "600" },
  filterBarContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  filterBar: { flexGrow: 0 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  chipTextActive: { color: "#fff" },
  list: { padding: 12, paddingBottom: 40, gap: 10 },
  row: { gap: 10 },
  roomCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  roomHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 },
  roomNumber: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  roomType: { fontSize: 12, color: "#475569", marginBottom: 10 },
  features: { gap: 4 },
  feature: { flexDirection: "row", alignItems: "center", gap: 4 },
  featureText: { fontSize: 11, color: "#94a3b8" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#94a3b8", fontSize: 14 },

  // Modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  sheetSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start", marginBottom: 16 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  stayInfo: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 16, gap: 4 },
  stayInfoLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase" },
  stayInfoValue: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  stayInfoSub: { fontSize: 12, color: "#64748b" },
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#2563eb", borderRadius: 12, padding: 14,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
