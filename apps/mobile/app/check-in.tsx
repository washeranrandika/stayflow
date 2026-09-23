/**
 * StayFlow Mobile – Check-in Screen
 * 3-step wizard: Room → Guest → Stay Details + Live Price Preview
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { BedDouble, User, Clock, Plus, Search, ChevronRight, RefreshCw } from "lucide-react-native";

const STAY_TYPES = [
  { key: "OVERNIGHT", label: "Overnight", icon: "🌙", description: "Full night stay" },
  { key: "DAY_USE", label: "Day Use", icon: "☀️", description: "Same-day departure" },
  { key: "HOURLY", label: "Hourly", icon: "⏱️", description: "Fixed hours" },
];

export default function MobileCheckInScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [stayType, setStayType] = useState("OVERNIGHT");
  const [numGuests, setNumGuests] = useState("1");
  const [duration, setDuration] = useState("1"); // days or hours depending on stayType
  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingPreview, setPricingPreview] = useState<any>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const {
    data: propsData,
    refetch: refetchProps,
    isRefetching: isRefetchingProps,
    isError: isPropsError,
    error: propsError,
  } = useQuery({
    queryKey: ["properties", user?.id],
    queryFn: () => api.get("/properties"),
    enabled: !!user,
  });
  const propertyId = propsData?.data?.data?.[0]?.id;

  const {
    data: roomsData,
    isLoading: loadingRooms,
    refetch: refetchRooms,
    isRefetching: isRefetchingRooms,
    isError: isRoomsError,
    error: roomsError,
  } = useQuery({
    queryKey: ["rooms-available", propertyId],
    queryFn: () => api.get(`/rooms/by-property/${propertyId}`, { params: { status: "AVAILABLE" } }),
    enabled: !!propertyId,
  });

  const onRefresh = async () => {
    const res = await refetchProps();
    const pid = res.data?.data?.data?.[0]?.id || propertyId;
    if (pid) {
      await refetchRooms();
    }
  };

  const { data: guestsData, isLoading: loadingGuests, isError: isGuestsError, error: guestsError } = useQuery({
    queryKey: ["guests-search", guestSearch],
    queryFn: () => api.get("/guests", { params: { search: guestSearch || undefined, limit: 30 } }),
  });

  const getErrorMessage = (err: any) => {
    if (!err) return null;
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (err.message) return err.message;
    return "An unexpected error occurred.";
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const buildCheckoutDate = () => {
    const d = new Date();
    const n = parseInt(duration) || 1;
    if (stayType === "HOURLY") {
      d.setHours(d.getHours() + n);
    } else if (stayType === "DAY_USE") {
      // Same day – set checkout to end of working day
      d.setHours(d.getHours() + (n * 8));
    } else {
      // OVERNIGHT – N days from now at 11:00 AM
      d.setDate(d.getDate() + n);
      d.setHours(11, 0, 0, 0);
    }
    return d;
  };

  const fetchPricingPreview = async () => {
    if (!selectedRoom || !propertyId) return;
    setPricingLoading(true);
    setPricingPreview(null);
    try {
      const checkout = buildCheckoutDate();
      const res = await api.post("/stays/pricing-estimate", {
        property_id: propertyId,
        room_id: selectedRoom.id,
        stay_type: stayType,
        expected_checkout: checkout.toISOString(),
      });
      setPricingPreview(res.data?.data);
    } catch (err: any) {
      // Non-fatal; just skip preview
      console.warn("Pricing preview failed", err?.response?.data);
    } finally {
      setPricingLoading(false);
    }
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();

  const checkInMutation = useMutation({
    mutationFn: (data: any) => api.post("/stays/check-in", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms-available"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      Alert.alert(
        "✅ Check-in Complete",
        `${selectedGuest.full_name} is checked in to Room ${selectedRoom.room_number}.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      let msg = "An error occurred.";
      if (typeof detail === "string") msg = detail;
      else if (detail?.message) msg = detail.message;
      else if (err.response?.data?.error?.message) msg = err.response.data.error.message;
      else if (err.message) msg = err.message;
      Alert.alert("Check-in Failed", msg);
    },
  });

  const handleComplete = () => {
    if (!selectedRoom || !selectedGuest) return;
    checkInMutation.mutate({
      property_id: propertyId,
      room_id: selectedRoom.id,
      primary_guest_id: selectedGuest.id,
      stay_type: stayType,
      num_guests: parseInt(numGuests) || 1,
      expected_checkout: buildCheckoutDate().toISOString(),
    });
  };

  const handleGoToDetails = () => {
    setStep(3);
    fetchPricingPreview();
  };

  // ── Guests list ────────────────────────────────────────────────────────────
  const guestItems: any[] = guestsData?.data?.data?.items ?? guestsData?.data?.data ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepper}>
        {["Room", "Guest", "Details"].map((label, idx) => {
          const n = idx + 1;
          return (
            <TouchableOpacity
              key={label}
              style={styles.stepItem}
              onPress={() => step > n && setStep(n)}
              disabled={step <= n}
            >
              <View style={[styles.stepCircle, step >= n && styles.stepCircleActive]}>
                <Text style={[styles.stepNum, step >= n && styles.stepNumActive]}>{n}</Text>
              </View>
              <Text style={[styles.stepLabel, step >= n && styles.stepLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={styles.stepLine} />
      </View>

      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetchingProps || isRefetchingRooms} onRefresh={onRefresh} />
        }
      >

        {/* ── STEP 1: Select Room ──────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <Text style={styles.title}>Select an Available Room</Text>

            {/* Error Banner */}
            {(isPropsError || isRoomsError) && (
              <View style={{
                backgroundColor: "#fef2f2",
                borderColor: "#fecaca",
                borderWidth: 1,
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
              }}>
                <Text style={{ color: "#991b1b", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>
                  ⚠️ Error Loading Rooms
                </Text>
                <Text style={{ color: "#b91c1c", fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
                  {getErrorMessage(propsError || roomsError)}
                </Text>
                <TouchableOpacity
                  onPress={onRefresh}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: "#ef4444",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 12 }}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {loadingRooms ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#2563eb" />
            ) : (
              <>
                {!isPropsError && !isRoomsError && (roomsData?.data?.data ?? []).length === 0 && (
                  <View style={styles.emptyBox}>
                    <BedDouble size={32} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No available rooms right now.</Text>
                    <TouchableOpacity
                      onPress={onRefresh}
                      style={{
                        marginTop: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "#eff6ff",
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <RefreshCw size={14} color="#2563eb" />
                      <Text style={{ color: "#2563eb", fontWeight: "600", fontSize: 13 }}>Tap to Refresh</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.grid}>
                  {(roomsData?.data?.data ?? []).map((r: any) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.roomCard, selectedRoom?.id === r.id && styles.roomCardSelected]}
                      onPress={() => setSelectedRoom(r)}
                    >
                      <Text style={[styles.roomNumber, selectedRoom?.id === r.id && styles.selectedText]}>
                        {r.room_number}
                      </Text>
                      <Text style={[styles.roomType, selectedRoom?.id === r.id && styles.selectedText]}>
                        {r.room_type?.name}
                      </Text>
                      <Text style={[styles.roomPrice, selectedRoom?.id === r.id && styles.selectedText]}>
                        Rs. {Number(r.room_type?.base_nightly_rate || 0).toLocaleString()}/night
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity
              style={[styles.btn, !selectedRoom && styles.btnDisabled]}
              disabled={!selectedRoom}
              onPress={() => setStep(2)}
            >
              <Text style={styles.btnText}>Continue to Guest →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Select Guest ─────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={styles.title}>Select Guest</Text>

            {/* Search bar */}
            <View style={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, phone, email..."
                value={guestSearch}
                onChangeText={setGuestSearch}
                returnKeyType="search"
              />
            </View>

            {/* New guest shortcut */}
            <TouchableOpacity
              style={styles.newGuestBtn}
              onPress={() => router.push("/new-guest" as any)}
            >
              <Plus size={16} color="#2563eb" />
              <Text style={styles.newGuestText}>Add New Walk-in Guest</Text>
              <ChevronRight size={16} color="#2563eb" />
            </TouchableOpacity>

            {loadingGuests ? (
              <ActivityIndicator style={{ marginTop: 16 }} color="#2563eb" />
            ) : (
              <View style={styles.guestList}>
                {guestItems.map((g: any) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.guestCard, selectedGuest?.id === g.id && styles.guestCardSelected]}
                    onPress={() => setSelectedGuest(g)}
                  >
                    <View style={styles.guestAvatar}>
                      <Text style={styles.guestAvatarText}>{g.full_name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.guestName, selectedGuest?.id === g.id && styles.selectedText]}>
                        {g.full_name}
                      </Text>
                      <Text style={[styles.guestSub, selectedGuest?.id === g.id && styles.selectedText]}>
                        {g.phone || g.email || "No contact"}
                      </Text>
                    </View>
                    {selectedGuest?.id === g.id && (
                      <View style={styles.checkMark}>
                        <Text style={styles.checkMarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {guestItems.length === 0 && !loadingGuests && (
                  <View style={styles.emptyBox}>
                    <User size={28} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No guests match your search.</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.row}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { flex: 1, marginLeft: 12 }, !selectedGuest && styles.btnDisabled]}
                disabled={!selectedGuest}
                onPress={handleGoToDetails}
              >
                <Text style={styles.btnText}>Continue →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 3: Details + Price Preview ─────────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={styles.title}>Stay Details</Text>

            {/* Selected summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <BedDouble size={16} color="#2563eb" />
                <Text style={styles.summaryText}>Room {selectedRoom?.room_number} — {selectedRoom?.room_type?.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <User size={16} color="#2563eb" />
                <Text style={styles.summaryText}>{selectedGuest?.full_name}</Text>
              </View>
            </View>

            {/* Stay type */}
            <Text style={styles.fieldLabel}>Stay Type</Text>
            <View style={styles.typeRow}>
              {STAY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeCard, stayType === t.key && styles.typeCardActive]}
                  onPress={() => {
                    setStayType(t.key);
                    setDuration(t.key === "HOURLY" ? "2" : "1");
                    setPricingPreview(null);
                  }}
                >
                  <Text style={styles.typeIcon}>{t.icon}</Text>
                  <Text style={[styles.typeLabel, stayType === t.key && styles.typeLabelActive]}>
                    {t.label}
                  </Text>
                  <Text style={[styles.typeDesc, stayType === t.key && styles.typeDescActive]}>
                    {t.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Duration */}
            <Text style={styles.fieldLabel}>
              {stayType === "HOURLY" ? "Number of Hours" : "Number of Days"}
            </Text>
            <View style={styles.durationRow}>
              <TouchableOpacity
                style={styles.durationBtn}
                onPress={() => {
                  const v = Math.max(1, (parseInt(duration) || 1) - 1);
                  setDuration(String(v));
                  setPricingPreview(null);
                }}
              >
                <Text style={styles.durationBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.durationInput}
                keyboardType="numeric"
                value={duration}
                onChangeText={(v) => { setDuration(v); setPricingPreview(null); }}
              />
              <TouchableOpacity
                style={styles.durationBtn}
                onPress={() => {
                  const v = (parseInt(duration) || 1) + 1;
                  setDuration(String(v));
                  setPricingPreview(null);
                }}
              >
                <Text style={styles.durationBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Guests count */}
            <Text style={styles.fieldLabel}>Number of Guests</Text>
            <View style={styles.durationRow}>
              <TouchableOpacity
                style={styles.durationBtn}
                onPress={() => setNumGuests(String(Math.max(1, (parseInt(numGuests) || 1) - 1)))}
              >
                <Text style={styles.durationBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.durationInput}
                keyboardType="numeric"
                value={numGuests}
                onChangeText={setNumGuests}
              />
              <TouchableOpacity
                style={styles.durationBtn}
                onPress={() => setNumGuests(String((parseInt(numGuests) || 1) + 1))}
              >
                <Text style={styles.durationBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Price Preview */}
            <TouchableOpacity style={styles.previewBtn} onPress={fetchPricingPreview} disabled={pricingLoading}>
              <Clock size={16} color="#2563eb" />
              <Text style={styles.previewBtnText}>
                {pricingLoading ? "Calculating price..." : "Refresh Price Estimate"}
              </Text>
            </TouchableOpacity>

            {pricingLoading && <ActivityIndicator color="#2563eb" style={{ marginVertical: 12 }} />}

            {pricingPreview && !pricingLoading && (
              <View style={styles.priceCard}>
                <Text style={styles.priceCardTitle}>💰 Estimated Charges</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Room Charge</Text>
                  <Text style={styles.priceValue}>Rs. {Number(pricingPreview.room_charge || 0).toLocaleString()}</Text>
                </View>
                {(pricingPreview.tax_amount > 0) && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Tax</Text>
                    <Text style={styles.priceValue}>Rs. {Number(pricingPreview.tax_amount || 0).toLocaleString()}</Text>
                  </View>
                )}
                <View style={[styles.priceRow, styles.priceTotalRow]}>
                  <Text style={styles.priceTotalLabel}>Estimated Total</Text>
                  <Text style={styles.priceTotalValue}>Rs. {Number(pricingPreview.grand_total || 0).toLocaleString()}</Text>
                </View>
                <Text style={styles.priceNote}>
                  ⏰ Expected checkout: {buildCheckoutDate().toLocaleString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit"
                  })}
                </Text>
              </View>
            )}

            <View style={styles.row}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { flex: 1, marginLeft: 12 }, checkInMutation.isPending && styles.btnDisabled]}
                disabled={checkInMutation.isPending}
                onPress={handleComplete}
              >
                {checkInMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>✓ Complete Check-in</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const BLUE = "#2563eb";
const DARK = "#0f172a";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // Stepper
  stepper: {
    flexDirection: "row", backgroundColor: "#fff",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
    position: "relative",
  },
  stepLine: {
    position: "absolute", top: 22, left: "20%", right: "20%",
    height: 2, backgroundColor: "#e2e8f0", zIndex: 0,
  },
  stepItem: { flex: 1, alignItems: "center", gap: 4, zIndex: 1 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center",
  },
  stepCircleActive: { backgroundColor: BLUE },
  stepNum: { fontSize: 13, fontWeight: "700", color: "#94a3b8" },
  stepNumActive: { color: "#fff" },
  stepLabel: { fontSize: 11, fontWeight: "600", color: "#94a3b8" },
  stepLabelActive: { color: BLUE },

  // Content
  content: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 18 },

  // Room grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  roomCard: {
    width: "47%", padding: 14, borderRadius: 12, borderWidth: 1.5,
    borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  roomCardSelected: { borderColor: BLUE, backgroundColor: "#eff6ff" },
  roomNumber: { fontSize: 20, fontWeight: "800", color: DARK },
  roomType: { fontSize: 12, color: "#64748b", marginTop: 3 },
  roomPrice: { fontSize: 12, color: "#16a34a", marginTop: 6, fontWeight: "600" },
  selectedText: { color: "#1d4ed8" },

  // Guest list
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f1f5f9", borderRadius: 10, paddingHorizontal: 12, height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: DARK },
  newGuestBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, backgroundColor: "#eff6ff",
    borderWidth: 1, borderColor: "#bfdbfe", marginBottom: 12,
  },
  newGuestText: { flex: 1, color: BLUE, fontWeight: "600", fontSize: 14 },
  guestList: { gap: 8, marginBottom: 20 },
  guestCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  guestCardSelected: { borderColor: BLUE, backgroundColor: "#eff6ff" },
  guestAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#e0e7ff", alignItems: "center", justifyContent: "center",
  },
  guestAvatarText: { fontSize: 16, fontWeight: "700", color: "#4338ca" },
  guestName: { fontSize: 15, fontWeight: "600", color: DARK },
  guestSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  checkMark: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: BLUE,
    alignItems: "center", justifyContent: "center",
  },
  checkMarkText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Stay type
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#334155", marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeCard: {
    flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: "#e2e8f0", backgroundColor: "#fff", alignItems: "center",
  },
  typeCardActive: { borderColor: BLUE, backgroundColor: "#eff6ff" },
  typeIcon: { fontSize: 20, marginBottom: 4 },
  typeLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  typeLabelActive: { color: "#1d4ed8" },
  typeDesc: { fontSize: 10, color: "#94a3b8", marginTop: 2, textAlign: "center" },
  typeDescActive: { color: "#3b82f6" },

  // Duration
  durationRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  durationBtn: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e8f0",
  },
  durationBtnText: { fontSize: 20, fontWeight: "700", color: "#334155" },
  durationInput: {
    flex: 1, borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 10,
    height: 44, textAlign: "center", fontSize: 18, fontWeight: "700", color: DARK,
  },

  // Summary
  summaryCard: {
    backgroundColor: "#f0f9ff", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#bae6fd", gap: 6, marginBottom: 4,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryText: { fontSize: 14, fontWeight: "600", color: "#0369a1" },

  // Price preview
  previewBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, backgroundColor: "#eff6ff", borderRadius: 10,
    borderWidth: 1, borderColor: "#bfdbfe", marginTop: 16,
  },
  previewBtnText: { color: BLUE, fontWeight: "600", fontSize: 14 },
  priceCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0", marginTop: 12, gap: 8,
  },
  priceCardTitle: { fontSize: 15, fontWeight: "700", color: DARK, marginBottom: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 14, color: "#64748b" },
  priceValue: { fontSize: 14, fontWeight: "600", color: DARK },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 10, marginTop: 4 },
  priceTotalLabel: { fontSize: 15, fontWeight: "700", color: DARK },
  priceTotalValue: { fontSize: 18, fontWeight: "800", color: BLUE },
  priceNote: { fontSize: 11, color: "#64748b", marginTop: 4 },

  // Buttons
  row: { flexDirection: "row", marginTop: 16 },
  btn: {
    backgroundColor: BLUE, padding: 16, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  backBtn: {
    padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1",
    alignItems: "center", justifyContent: "center", width: 90,
  },
  backBtnText: { color: "#334155", fontSize: 14, fontWeight: "600" },

  // Empty state
  emptyBox: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
});
