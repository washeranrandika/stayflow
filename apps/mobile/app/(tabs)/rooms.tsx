/**
 * StayFlow Mobile – Rooms Screen
 * Lists all rooms with property scoping and status badges.
 * Supports Member-based property assignment and multi-property filtering.
 */
import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, Platform
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, AirVent, LogIn, LogOut, Brush, Info, X, Building2, MapPin, CheckCircle, RefreshCw } from "lucide-react-native";

const STATUS_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  AVAILABLE:      { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", dot: "#22c55e" },
  OCCUPIED:       { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", dot: "#ef4444" },
  RESERVED:       { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", dot: "#3b82f6" },
  CLEANING:       { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#f59e0b" },
  MAINTENANCE:    { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", dot: "#f97316" },
  OUT_OF_SERVICE: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#94a3b8" },
};

const FILTERS = ["ALL", "AVAILABLE", "OCCUPIED", "CLEANING", "RESERVED", "MAINTENANCE"];

export default function RoomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const selectedPropertyId = useAuthStore((s) => s.selectedPropertyId);
  const setSelectedPropertyId = useAuthStore((s) => s.setSelectedPropertyId);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [activeStay, setActiveStay] = useState<any>(null);
  const [loadingStay, setLoadingStay] = useState(false);

  // 1. Fetch organization properties
  const { data: propsData, refetch: refetchProps } = useQuery({
    queryKey: ["properties", user?.id],
    queryFn: async () => {
      const res = await api.get("/properties");
      return res.data?.data || [];
    },
    enabled: !!user,
  });

  const properties: any[] = Array.isArray(propsData) ? propsData : [];
  const assignedPropId = user?.assigned_property_id;
  const isAssignedToSingleProperty = !!assignedPropId;

  // Active property ID resolution
  const activePropertyId = isAssignedToSingleProperty
    ? assignedPropId
    : selectedPropertyId || "all";

  // 2. Fetch rooms directly using org-level endpoint with optional property_id
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["rooms", activePropertyId],
    queryFn: async () => {
      const params: any = {};
      if (activePropertyId && activePropertyId !== "all") {
        params.property_id = activePropertyId;
      }
      const res = await api.get("/rooms", { params });
      return res.data?.data || [];
    },
    enabled: !!user,
  });

  const onRefreshAll = async () => {
    await Promise.all([refetch(), refetchProps()]);
  };

  const rooms: any[] = data || [];
  const filtered = statusFilter === "ALL" ? rooms : rooms.filter((r) => r.status === statusFilter);

  // Status Change Mutation (e.g. Mark Clean)
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/rooms/${id}/status`, { status }),
    onSuccess: () => {
      Alert.alert("Success", "Room status updated!");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedRoom(null);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.detail?.message || "Failed to update status");
    },
  });

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
          <View>
            <Text style={styles.roomNumber}>Room {item.room_number}</Text>
            {item.property_name && (
              <View style={styles.propertyTag}>
                <MapPin size={10} color="#64748b" />
                <Text style={styles.propertyTagText} numberOfLines={1}>
                  {item.property_name}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
            <View style={[styles.dot, { backgroundColor: s.dot }]} />
            <Text style={[styles.badgeText, { color: s.text }]}>
              {item.status.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        <Text style={styles.roomType}>{item.room_type?.name || "Standard Room"}</Text>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Users size={12} color="#94a3b8" />
            <Text style={styles.featureText}>Up to {item.max_guests}</Text>
          </View>
          {item.room_type?.is_ac && (
            <View style={styles.feature}>
              <AirVent size={12} color="#0284c7" />
              <Text style={[styles.featureText, { color: "#0284c7", fontWeight: "600" }]}>AC</Text>
            </View>
          )}
          {item.floor && (
            <View style={styles.feature}>
              <Text style={styles.featureText}>Fl {item.floor}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container]}>
      {/* ── Fixed Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Room Inventory</Text>
          <Text style={styles.subtitle}>
            {isAssignedToSingleProperty
              ? `Scoped to ${user?.assigned_property_name || "Assigned Property"}`
              : `${rooms.length} rooms configured across properties`}
          </Text>
        </View>

        {isAssignedToSingleProperty && (
          <View style={styles.memberPropertyBadge}>
            <Building2 size={12} color="#1d4ed8" />
            <Text style={styles.memberPropertyText} numberOfLines={1}>
              {user?.assigned_property_name || "Your Branch"}
            </Text>
          </View>
        )}
      </View>

      {/* ── Property Switcher Chips (For Owners & Multi-Property Staff) ───── */}
      {!isAssignedToSingleProperty && properties.length > 1 && (
        <View style={styles.propertyChipContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyChipScroll}>
            <TouchableOpacity
              onPress={() => setSelectedPropertyId("all")}
              style={[
                styles.propertyChip,
                activePropertyId === "all" && styles.propertyChipActive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.propertyChipText,
                  activePropertyId === "all" && styles.propertyChipTextActive,
                ]}
              >
                🌐 All Properties ({rooms.length})
              </Text>
            </TouchableOpacity>

            {properties.map((p: any) => {
              const isSelected = activePropertyId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPropertyId(p.id)}
                  style={[
                    styles.propertyChip,
                    isSelected && styles.propertyChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Building2 size={12} color={isSelected ? "#ffffff" : "#64748b"} style={{ marginRight: 4 }} />
                  <Text
                    style={[
                      styles.propertyChipText,
                      isSelected && styles.propertyChipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Status Filter Chips ────────────────────────────────────────────── */}
      <View style={styles.statusChipContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChipScroll}>
          {FILTERS.map((st) => {
            const isSelected = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {st.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Room Cards Grid ───────────────────────────────────────────────── */}
      {isLoading && !isRefetching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading room grid...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Unable to load rooms</Text>
          <Text style={styles.emptySubtitle}>
            {(error as any)?.response?.data?.detail?.message || (error as any)?.message || "Failed to fetch room inventory."}
          </Text>
          <TouchableOpacity onPress={onRefreshAll} style={styles.retryBtn} activeOpacity={0.8}>
            <RefreshCw size={14} color="#2563eb" />
            <Text style={styles.retryBtnText}>Tap to Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          numColumns={2}
          columnWrapperStyle={filtered.length > 0 ? styles.columnWrapper : undefined}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && { flexGrow: 1, justifyContent: "center" },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefreshAll}
              tintColor="#2563eb"
              colors={["#2563eb"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🏨</Text>
              <Text style={styles.emptyTitle}>No rooms found</Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter !== "ALL"
                  ? `No rooms currently in ${statusFilter.toLowerCase()} status.`
                  : "No rooms configured for this property yet. Pull down to refresh."}
              </Text>
              <TouchableOpacity onPress={onRefreshAll} style={styles.retryBtn} activeOpacity={0.8}>
                <RefreshCw size={14} color="#2563eb" />
                <Text style={styles.retryBtnText}>Tap to refresh</Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── ROOM DETAIL / ACTION MODAL ────────────────────────────────────── */}
      {selectedRoom && (
        <Modal visible={!!selectedRoom} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Room {selectedRoom.room_number}</Text>
                  <Text style={styles.modalSubTitle}>
                    {selectedRoom.property_name ? `${selectedRoom.property_name} • ` : ""}
                    {selectedRoom.room_type?.name || "Standard Room"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.modalClose}>
                  <X size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {/* Status info */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current Status</Text>
                  <View style={[styles.badge, { backgroundColor: STATUS_MAP[selectedRoom.status]?.bg || "#f1f5f9" }]}>
                    <Text style={[styles.badgeText, { color: STATUS_MAP[selectedRoom.status]?.text || "#334155" }]}>
                      {selectedRoom.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Max Capacity</Text>
                  <Text style={styles.detailVal}>{selectedRoom.max_guests} Guests</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nightly Rate</Text>
                  <Text style={[styles.detailVal, { color: "#16a34a", fontWeight: "700" }]}>
                    Rs. {Number(selectedRoom.room_type?.base_nightly_rate || 0).toLocaleString()}
                  </Text>
                </View>

                {selectedRoom.notes && (
                  <View style={[styles.detailRow, { flexDirection: "column", alignItems: "flex-start" }]}>
                    <Text style={styles.detailLabel}>Notes</Text>
                    <Text style={[styles.detailVal, { marginTop: 2, color: "#64748b" }]}>{selectedRoom.notes}</Text>
                  </View>
                )}

                {/* Active stay details if occupied */}
                {loadingStay && (
                  <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
                )}
                {activeStay && (
                  <View style={styles.stayBox}>
                    <Text style={styles.stayBoxTitle}>👤 Current Guest</Text>
                    <Text style={styles.stayGuestName}>{activeStay.primary_guest?.full_name || "In-House Guest"}</Text>
                    <Text style={styles.staySub}>
                      Expected Checkout: {new Date(activeStay.expected_checkout).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                {selectedRoom.status === "AVAILABLE" && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#2563eb" }]}
                    onPress={() => {
                      const r = selectedRoom;
                      setSelectedRoom(null);
                      router.push({
                        pathname: "/check-in",
                        params: { room_id: r.id, property_id: r.property_id },
                      } as any);
                    }}
                  >
                    <LogIn size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Walk-in Check-in</Text>
                  </TouchableOpacity>
                )}

                {selectedRoom.status === "CLEANING" && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#16a34a" }]}
                    onPress={() => statusMutation.mutate({ id: selectedRoom.id, status: "AVAILABLE" })}
                    disabled={statusMutation.isPending}
                  >
                    <Brush size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>
                      {statusMutation.isPending ? "Updating..." : "Mark as Clean & Ready"}
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedRoom.status === "OCCUPIED" && activeStay && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#dc2626" }]}
                    onPress={() => {
                      const stayId = activeStay.id;
                      setSelectedRoom(null);
                      router.push({ pathname: "/checkout", params: { stayId } } as any);
                    }}
                  >
                    <LogOut size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Proceed to Checkout</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  memberPropertyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 160,
  },
  memberPropertyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  propertyChipContainer: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  propertyChipScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  propertyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  propertyChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  propertyChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  propertyChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  statusChipContainer: {
    paddingVertical: 8,
  },
  statusChipScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  roomCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  roomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  roomNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  propertyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  propertyTagText: {
    fontSize: 9.5,
    color: "#64748b",
    fontWeight: "600",
    maxWidth: 80,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  roomType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  features: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 6,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  featureText: {
    fontSize: 10.5,
    color: "#64748b",
    fontWeight: "500",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 10,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalSubTitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalClose: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  detailLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  detailVal: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "600",
  },
  stayBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  stayBoxTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1d4ed8",
    marginBottom: 2,
  },
  stayGuestName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  staySub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  modalActions: {
    marginTop: 16,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
