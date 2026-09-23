/**
 * StayFlow Mobile – Bookings & In-House Stays Screen
 * Lists upcoming reservations, in-house checked-in stays, and past booking history.
 */
import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, Platform
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Calendar as CalendarIcon, User as UserIcon, BedDouble, X,
  LogIn, LogOut, Clock, ShieldCheck, ChevronRight, RefreshCw,
  Users, Plus
} from "lucide-react-native";

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  CONFIRMED:   { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  PENDING:     { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  CHECKED_IN:  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  COMPLETED:   { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" },
  CANCELLED:   { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  NO_SHOW:     { bg: "#fdf4ff", border: "#e9d5ff", text: "#7e22ce" },
};

function fmt(iso?: any) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return String(iso);
  }
}

function fmtTime(iso?: any) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch {
    return "";
  }
}

import { useAuthStore } from "@/store/auth";
import { Building2 } from "lucide-react-native";

export default function BookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const selectedPropertyId = useAuthStore((s) => s.selectedPropertyId);
  const setSelectedPropertyId = useAuthStore((s) => s.setSelectedPropertyId);

  const assignedPropId = user?.assigned_property_id;
  const isAssignedToSingleProperty = !!assignedPropId;
  const activePropertyId = isAssignedToSingleProperty ? assignedPropId : (selectedPropertyId || "all");

  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState("ALL");

  const { data: propsData } = useQuery({
    queryKey: ["properties", user?.id],
    queryFn: async () => {
      const res = await api.get("/properties");
      return res.data?.data || [];
    },
    enabled: !!user,
  });
  const properties: any[] = propsData || [];

  // Query 1: Reservations
  const {
    data: resData,
    isLoading: loadingReservations,
    isError: isResError,
    error: resError,
    refetch: refetchReservations,
    isRefetching: isRefetchingRes,
  } = useQuery({
    queryKey: ["reservations", filter, activePropertyId],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (filter !== "ALL" && filter !== "CHECKED_IN") {
        params.status = filter;
      }
      if (activePropertyId && activePropertyId !== "all") {
        params.property_id = activePropertyId;
      }
      const res = await api.get("/bookings", { params });
      return res.data?.data || [];
    },
  });

  // Query 2: In-House Checked-in Stays (from /stays/active)
  const {
    data: activeStaysData,
    isLoading: loadingStays,
    refetch: refetchStays,
    isRefetching: isRefetchingStays,
  } = useQuery({
    queryKey: ["mobileActiveStays", activePropertyId],
    queryFn: async () => {
      const params: any = {};
      if (activePropertyId && activePropertyId !== "all") {
        params.property_id = activePropertyId;
      }
      const res = await api.get("/stays/active", { params });
      return res.data?.data || [];
    },
  });

  const onRefreshAll = async () => {
    await Promise.all([refetchReservations(), refetchStays()]);
  };

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/bookings/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setSelected(null);
      Alert.alert("Reservation Cancelled", "The booking has been successfully cancelled.");
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Failed to cancel reservation";
      Alert.alert("Cancellation Error", msg);
    },
  });

  const handleCancelBooking = (id: string) => {
    Alert.alert(
      "Cancel Reservation",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No, Keep Booking", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ id, reason: "Cancelled by staff/guest request" }),
        },
      ]
    );
  };

  const confirmMutation = useMutation({
    mutationFn: (reservationId: string) =>
      api.post(`/bookings/${reservationId}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setSelected(null);
      Alert.alert("✅ Booking Confirmed", "Reservation status is now Confirmed.");
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Confirmation failed";
      Alert.alert("Error", msg);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (reservationId: string) =>
      api.post("/stays/check-in", {
        reservation_id: reservationId,
        property_id: selected?.property_id,
        room_id: selected?.room_id,
        primary_guest_id: selected?.primary_guest_id,
        stay_type: selected?.stay_type || "OVERNIGHT",
        num_guests: selected?.num_guests || 1,
        expected_checkout: selected?.expected_checkout_date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["mobileActiveStays"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setSelected(null);
      Alert.alert("✅ Checked In", "Guest has been successfully checked in.");
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Check-in failed";
      Alert.alert("Error", msg);
    },
  });

  // Safe extraction of arrays
  const activeStaysList: any[] = Array.isArray(activeStaysData)
    ? activeStaysData
    : (Array.isArray(activeStaysData?.data) ? activeStaysData.data : (Array.isArray(activeStaysData?.items) ? activeStaysData.items : []));

  const rawBookingsList: any[] = Array.isArray(resData)
    ? resData
    : (Array.isArray(resData?.items) ? resData.items : (Array.isArray(resData?.data) ? resData.data : []));

  // Normalize active in-house stays into unified card items
  const activeStays: any[] = activeStaysList.map((s: any) => ({
    id: s.id,
    is_stay: true,
    stay_id: s.id,
    reservation_number: s.reservation_id ? `RES-${s.room?.room_number || "—"}` : `ROOM-${s.room?.room_number || "—"}`,
    status: "CHECKED_IN",
    stay_type: s.stay_type || "OVERNIGHT",
    primary_guest: s.primary_guest,
    room: s.room,
    check_in_date: s.actual_check_in,
    expected_checkout_date: s.expected_checkout,
    actual_check_in: s.actual_check_in,
    expected_checkout: s.expected_checkout,
    num_guests: s.num_guests || 1,
    notes: s.notes,
    folio_total: s.folio?.total,
  }));

  // Combine and filter items
  let combinedItems: any[] = [];
  if (filter === "CHECKED_IN") {
    combinedItems = activeStays;
  } else if (filter === "ALL") {
    const stayIdsLinked = new Set(activeStays.map((s) => s.id));
    const nonDuplicateBookings = rawBookingsList.filter((b: any) => b.status !== "CHECKED_IN" || !stayIdsLinked.has(b.id));
    combinedItems = [...activeStays, ...nonDuplicateBookings];
  } else {
    combinedItems = rawBookingsList.filter((b: any) => b.status === filter);
  }

  const isLoading = loadingReservations || loadingStays;
  const isRefetching = isRefetchingRes || isRefetchingStays;

  const renderBooking = ({ item }: { item: any }) => {
    const s = STATUS_STYLES[item.status] ?? STATUS_STYLES["PENDING"];
    const isStay = item.is_stay || item.status === "CHECKED_IN";
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.resNumber}>#{item.reservation_number || item.id?.slice(0, 8)}</Text>
            {isStay && (
              <View style={styles.inHouseTag}>
                <Text style={styles.inHouseTagText}>In-House</Text>
              </View>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
            <Text style={[styles.badgeText, { color: s.text }]}>{item.status?.replace("_", " ")}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <UserIcon size={15} color="#64748b" />
            <Text style={styles.guestTitle}>{item.primary_guest?.full_name ?? "Guest"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Clock size={15} color="#64748b" />
            <Text style={styles.detailText}>
              {fmt(item.check_in_date || item.actual_check_in)} {fmtTime(item.check_in_date || item.actual_check_in)}
              {" → "}
              {fmt(item.expected_checkout_date || item.expected_checkout)} {fmtTime(item.expected_checkout_date || item.expected_checkout)}
            </Text>
          </View>

          {item.room && (
            <View style={styles.detailRow}>
              <BedDouble size={15} color="#2563eb" />
              <Text style={[styles.detailText, { fontWeight: "700", color: "#1e40af" }]}>
                Room {item.room.room_number} • {item.stay_type}
              </Text>
            </View>
          )}

          {item.notes && (
            <Text style={styles.notesText} numberOfLines={1}>
              📝 {item.notes}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Bookings & Stays</Text>
          <Text style={styles.topBarSub}>{combinedItems.length} total entries</Text>
        </View>
        <TouchableOpacity
          style={styles.newResBtn}
          onPress={() => router.push("/new-reservation" as any)}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.newResBtnText}>New Reservation</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips category bar */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
        >
          {[
            { key: "ALL", label: `All (${combinedItems.length})` },
            { key: "CHECKED_IN", label: `Checked In (${activeStays.length})` },
            { key: "CONFIRMED", label: "Confirmed" },
            { key: "PENDING", label: "Pending" },
            { key: "COMPLETED", label: "Completed" },
            { key: "CANCELLED", label: "Cancelled" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.chip, filter === item.key && styles.chipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading && !isRefetching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={combinedItems}
          keyExtractor={(item) => `${item.is_stay ? "stay" : "res"}-${item.id}`}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefreshAll} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <CalendarIcon size={36} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>
                {filter === "CHECKED_IN" ? "No Active In-House Stays" : "No Bookings Found"}
              </Text>
              <Text style={styles.emptyText}>
                {filter === "CHECKED_IN"
                  ? "All rooms are currently vacant or ready for check-in."
                  : "No reservations found under this filter."}
              </Text>
              <TouchableOpacity onPress={onRefreshAll} style={styles.refreshChip}>
                <RefreshCw size={14} color="#2563eb" />
                <Text style={{ color: "#2563eb", fontWeight: "600", fontSize: 13 }}>Tap to Refresh</Text>
              </TouchableOpacity>
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
              <View>
                <Text style={styles.modalTitle}>
                  {selected?.is_stay ? `In-House Stay • Room ${selected.room?.room_number}` : `Reservation #${selected?.reservation_number ?? selected?.id?.slice(0, 8)}`}
                </Text>
                <Text style={{ fontSize: 12, color: "#64748b" }}>{selected?.stay_type} Stay</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Guest */}
                <Text style={styles.modalSection}>Guest Details</Text>
                <Text style={styles.modalValue}>{selected.primary_guest?.full_name}</Text>
                <Text style={styles.modalSub}>
                  📞 {selected.primary_guest?.phone || "No phone"} {selected.primary_guest?.email ? `• ${selected.primary_guest.email}` : ""}
                </Text>

                {/* Stay Timing */}
                <Text style={styles.modalSection}>Attendance & Discharge Schedule</Text>
                <View style={styles.modalTimingBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTimingLabel}>🟢 Check-in / Arrival</Text>
                    <Text style={styles.modalTimingVal}>{fmt(selected.check_in_date || selected.actual_check_in)}</Text>
                    <Text style={styles.modalSub}>{fmtTime(selected.check_in_date || selected.actual_check_in)}</Text>
                  </View>
                  <View style={styles.modalTimingDivider} />
                  <View style={{ flex: 1, paddingLeft: 10 }}>
                    <Text style={styles.modalTimingLabel}>🔴 Expected Discharge</Text>
                    <Text style={styles.modalTimingVal}>{fmt(selected.expected_checkout_date || selected.expected_checkout)}</Text>
                    <Text style={styles.modalSub}>{fmtTime(selected.expected_checkout_date || selected.expected_checkout)}</Text>
                  </View>
                </View>

                {/* Room */}
                {selected.room && (
                  <>
                    <Text style={styles.modalSection}>Assigned Room</Text>
                    <Text style={styles.modalValue}>Room {selected.room.room_number}</Text>
                  </>
                )}

                {/* Notes & Retained ID */}
                {selected.notes && (
                  <>
                    <Text style={styles.modalSection}>Special Notes & Custody</Text>
                    <View style={styles.notesBox}>
                      <Text style={styles.notesBoxText}>{selected.notes}</Text>
                    </View>
                  </>
                )}

                {/* Status */}
                <Text style={styles.modalSection}>Current Status</Text>
                <View style={[styles.badge, {
                  alignSelf: "flex-start",
                  backgroundColor: (STATUS_STYLES[selected.status] ?? STATUS_STYLES["PENDING"]).bg,
                  borderColor: (STATUS_STYLES[selected.status] ?? STATUS_STYLES["PENDING"]).border,
                }]}>
                  <Text style={[styles.badgeText, {
                    color: (STATUS_STYLES[selected.status] ?? STATUS_STYLES["PENDING"]).text,
                  }]}>{selected.status?.replace("_", " ")}</Text>
                </View>

                {/* Action 1: If In-House Checked-in Stay -> Proceed to Checkout */}
                {selected.status === "CHECKED_IN" && (
                  <TouchableOpacity
                    style={styles.checkoutNavBtn}
                    onPress={() => {
                      setSelected(null);
                      router.push("/checkout" as any);
                    }}
                  >
                    <LogOut size={18} color="#fff" />
                    <Text style={styles.checkoutNavBtnText}>Manage & Checkout Stay</Text>
                  </TouchableOpacity>
                )}

                {/* Action 2: If Pending Reservation -> Confirm Booking */}
                {selected.status === "PENDING" && (
                  <TouchableOpacity
                    style={[styles.checkInBtn, { backgroundColor: "#16a34a" }]}
                    onPress={() => confirmMutation.mutate(selected.id)}
                    disabled={confirmMutation.isPending}
                  >
                    {confirmMutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <ShieldCheck size={18} color="#fff" />
                        <Text style={styles.checkInBtnText}>✓ Confirm Booking Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Action 3: If Confirmed Reservation -> Check In */}
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
                        <Text style={styles.checkInBtnText}>Check-in Guest Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Action 4: Cancel Reservation (if not already completed/cancelled/in-house) */}
                {(selected.status === "PENDING" || selected.status === "CONFIRMED") && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancelBooking(selected.id)}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? (
                      <ActivityIndicator color="#ef4444" />
                    ) : (
                      <Text style={styles.cancelBtnText}>✕ Cancel This Reservation</Text>
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
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  topBarTitle: { fontSize: 19, fontWeight: "900", color: "#0f172a", letterSpacing: -0.3 },
  topBarSub: { fontSize: 11, color: "#64748b", marginTop: 2, fontWeight: "600" },
  newResBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  newResBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  filterBarContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  filterBar: {
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  resNumber: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  inHouseTag: { backgroundColor: "#eff6ff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "#bfdbfe" },
  inHouseTagText: { fontSize: 10, fontWeight: "700", color: "#1d4ed8" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  details: { gap: 6 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guestTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  detailText: { fontSize: 13, color: "#475569" },
  notesText: { fontSize: 12, color: "#64748b", marginTop: 2 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155", marginTop: 8 },
  emptyText: { color: "#94a3b8", fontSize: 13, textAlign: "center" },
  refreshChip: {
    marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#eff6ff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: "85%",
  },
  modalHandle: { width: 40, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalSection: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginTop: 14, marginBottom: 4 },
  modalValue: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  modalSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modalTimingBox: {
    flexDirection: "row", backgroundColor: "#f0f9ff", borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: "#bae6fd", marginTop: 4,
  },
  modalTimingLabel: { fontSize: 10, fontWeight: "700", color: "#64748b" },
  modalTimingVal: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  modalTimingDivider: { width: 1, height: 32, backgroundColor: "#bae6fd" },
  notesBox: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  notesBoxText: { fontSize: 12, color: "#334155" },

  checkInBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#2563eb", borderRadius: 12,
    padding: 15, marginTop: 20,
  },
  checkInBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  checkoutNavBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#0f172a", borderRadius: 12,
    padding: 15, marginTop: 20,
  },
  checkoutNavBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cancelBtn: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 14, marginTop: 12, borderRadius: 12,
    backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca",
  },
  cancelBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "700" },
});
