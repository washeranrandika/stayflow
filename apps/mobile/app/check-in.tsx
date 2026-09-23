
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, RefreshControl,
  Switch
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  BedDouble, User, Clock, Plus, Search, ChevronRight, RefreshCw,
  CreditCard, ShieldAlert, FileCheck, CheckCircle2, AlertCircle,
  Users, Sparkles, Calendar
} from "lucide-react-native";

const STAY_TYPES = [
  { key: "OVERNIGHT", label: "Overnight", icon: "🌙", description: "Standard night stay" },
  { key: "DAY_USE", label: "Day Use", icon: "☀️", description: "Same-day daytime use" },
  { key: "HOURLY", label: "Hourly", icon: "⏱️", description: "Flexible hourly stay" },
];

const ID_TYPES = [
  { key: "NIC", label: "National ID (NIC)" },
  { key: "PASSPORT", label: "Passport" },
  { key: "DRIVING_LICENSE", label: "Driving License" },
  { key: "OTHER", label: "Other ID" },
];

const ROOM_ARRANGEMENTS = [
  { key: "ALL", label: "All Rooms" },
  { key: "SINGLE", label: "Single (1P)" },
  { key: "DOUBLE", label: "Double (2P)" },
  { key: "TWIN", label: "Twin Beds" },
  { key: "SUITE", label: "Suite / Family" },
];

export default function MobileCheckInScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [stayType, setStayType] = useState("OVERNIGHT");
  const [numGuests, setNumGuests] = useState("1");
  const [arrangementFilter, setArrangementFilter] = useState("ALL");
  const [duration, setDuration] = useState("1"); // days or hours
  const [guestSearch, setGuestSearch] = useState("");
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingPreview, setPricingPreview] = useState<any>(null);

  // Front desk verification, Attendance & Custody states
  const [idRetained, setIdRetained] = useState(false);
  const [retainedIdDoc, setRetainedIdDoc] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(true);
  const [specialNotes, setSpecialNotes] = useState("");

  // Inline Quick Guest Creation
  const [showQuickGuestModal, setShowQuickGuestModal] = useState(false);
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestPhone, setNewGuestPhone] = useState("");
  const [newGuestIdType, setNewGuestIdType] = useState("NIC");
  const [newGuestIdNumber, setNewGuestIdNumber] = useState("");

  const [selectedPropId, setSelectedPropId] = useState<string>("");

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
  const properties: any[] = propsData?.data?.data || [];
  const propertyId = user?.assigned_property_id || selectedPropId || properties[0]?.id;

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

  const { data: guestsData, isLoading: loadingGuests, refetch: refetchGuests } = useQuery({
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
  const checkInDate = new Date();

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const formatShortDate = (d: Date, withDay = false) => {
    if (!d || isNaN(d.getTime())) return "—";
    const dayStr = withDay ? `${DAYS[d.getDay()]}, ` : "";
    return `${dayStr}${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };

  const formatShortTime = (d: Date) => {
    if (!d || isNaN(d.getTime())) return "";
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const buildCheckoutDate = () => {
    const d = new Date();
    const n = parseInt(duration) || 1;
    if (stayType === "HOURLY") {
      d.setHours(d.getHours() + n);
    } else if (stayType === "DAY_USE") {
      d.setHours(d.getHours() + (n * 8));
    } else {
      d.setDate(d.getDate() + n);
      d.setHours(11, 0, 0, 0);
    }
    return d;
  };

  const fetchPricingPreview = async () => {
    if (!selectedRoom || !propertyId) return;
    setPricingLoading(true);
    try {
      const checkout = buildCheckoutDate();
      const res = await api.post("/stays/pricing-estimate", {
        property_id: propertyId,
        room_id: selectedRoom.id,
        stay_type: stayType,
        expected_checkout: checkout.toISOString(),
        num_guests: parseInt(numGuests) || 1,
      });
      setPricingPreview(res.data?.data);
    } catch (err: any) {
      console.warn("Pricing preview failed", err?.response?.data);
    } finally {
      setPricingLoading(false);
    }
  };

  // Live Auto-recalculate pricing in Step 3 whenever duration, guests, or stayType changes
  useEffect(() => {
    if (step === 3 && selectedRoom && propertyId) {
      const timer = setTimeout(() => {
        fetchPricingPreview();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [step, duration, numGuests, stayType, selectedRoom?.id, propertyId]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const quickGuestMutation = useMutation({
    mutationFn: (data: any) => api.post("/guests", data),
    onSuccess: (res) => {
      const g = res.data?.data;
      queryClient.invalidateQueries({ queryKey: ["guests-search"] });
      setSelectedGuest(g);
      setShowQuickGuestModal(false);
      setNewGuestName("");
      setNewGuestPhone("");
      setNewGuestIdNumber("");
      Alert.alert("Guest Registered", `${g.full_name} has been created and selected.`);
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Failed to create guest.";
      Alert.alert("Registration Error", msg);
    }
  });

  const handleCreateQuickGuest = () => {
    if (!newGuestName.trim()) {
      Alert.alert("Required", "Please enter guest's full name.");
      return;
    }
    quickGuestMutation.mutate({
      full_name: newGuestName.trim(),
      phone: newGuestPhone.trim() || undefined,
      notes: newGuestIdNumber ? `[ID: ${newGuestIdType} - ${newGuestIdNumber.trim()}]` : undefined,
    });
  };

  const checkInMutation = useMutation({
    mutationFn: (data: any) => api.post("/stays/check-in", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms-available"] });
      queryClient.invalidateQueries({ queryKey: ["mobileActiveStays"] });
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

    // Build structured notes
    const notesParts = [];
    if (idRetained) {
      const docLabel = retainedIdDoc.trim() || (selectedGuest.notes?.includes("ID:") ? selectedGuest.notes : "Physical ID Retained");
      notesParts.push(`[RETAINED_ID: ${docLabel}]`);
    }
    if (signatureConfirmed) {
      notesParts.push("[SIGNATURE: VERIFIED & ACCEPTED]");
    }
    if (specialNotes.trim()) {
      notesParts.push(specialNotes.trim());
    }

    checkInMutation.mutate({
      property_id: propertyId,
      room_id: selectedRoom.id,
      primary_guest_id: selectedGuest.id,
      stay_type: stayType,
      num_guests: parseInt(numGuests) || 1,
      expected_checkout: buildCheckoutDate().toISOString(),
      notes: notesParts.length > 0 ? notesParts.join(" | ") : undefined,
    });
  };

  const handleGoToDetails = () => {
    setStep(3);
    fetchPricingPreview();
  };

  const guestItems: any[] = guestsData?.data?.data?.items ?? guestsData?.data?.data ?? [];
  const roomMaxGuests = selectedRoom?.room_type?.max_guests || selectedRoom?.max_guests || 2;
  const currentGuestCount = parseInt(numGuests) || 1;
  const exceedsCapacity = currentGuestCount > roomMaxGuests;
  const checkoutDate = buildCheckoutDate();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepper}>
        {[
          { label: "Room", num: 1 },
          { label: "Guest", num: 2 },
          { label: "Stay Details", num: 3 },
        ].map((item) => (
          <TouchableOpacity
            key={item.num}
            style={styles.stepItem}
            onPress={() => step > item.num && setStep(item.num)}
            disabled={step <= item.num}
          >
            <View style={[styles.stepCircle, step >= item.num && styles.stepCircleActive]}>
              <Text style={[styles.stepNum, step >= item.num && styles.stepNumActive]}>{item.num}</Text>
            </View>
            <Text style={[styles.stepLabel, step >= item.num && styles.stepLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.stepLine} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetchingProps || isRefetchingRooms} onRefresh={onRefresh} />
        }
      >

        {/* ── STEP 1: Select Room ──────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.title}>Select an Available Room</Text>
              <Text style={styles.subtitle}>Choose a room to view capacity, rates and start check-in.</Text>
            </View>

            {/* Error Banner */}
            {(isPropsError || isRoomsError) && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorTitle}>⚠️ Error Loading Rooms</Text>
                <Text style={styles.errorMsg}>{getErrorMessage(propsError || roomsError)}</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Arrangement & Bed Preference Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {ROOM_ARRANGEMENTS.map((arr) => {
                  const isActive = arrangementFilter === arr.key;
                  return (
                    <TouchableOpacity
                      key={arr.key}
                      style={[
                        {
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                          backgroundColor: isActive ? "#2563eb" : "#f1f5f9",
                          borderWidth: 1, borderColor: isActive ? "#2563eb" : "#e2e8f0",
                        }
                      ]}
                      onPress={() => setArrangementFilter(arr.key)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: isActive ? "#fff" : "#475569" }}>
                        {arr.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {loadingRooms ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#2563eb" />
            ) : (
              <>
                {!isPropsError && !isRoomsError && (roomsData?.data?.data ?? []).length === 0 && (
                  <View style={styles.emptyBox}>
                    <BedDouble size={32} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No available rooms right now.</Text>
                    <TouchableOpacity onPress={onRefresh} style={styles.refreshChip}>
                      <RefreshCw size={14} color="#2563eb" />
                      <Text style={{ color: "#2563eb", fontWeight: "600", fontSize: 13 }}>Tap to Refresh</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.grid}>
                  {(roomsData?.data?.data ?? [])
                    .filter((r: any) => {
                      if (arrangementFilter === "ALL") return true;
                      const typeName = (r.room_type?.name || "").toLowerCase();
                      const maxG = r.room_type?.max_guests || r.max_guests || 2;
                      if (arrangementFilter === "SINGLE") return typeName.includes("single") || maxG === 1;
                      if (arrangementFilter === "DOUBLE") return typeName.includes("double") || typeName.includes("deluxe") || maxG === 2;
                      if (arrangementFilter === "TWIN") return typeName.includes("twin");
                      if (arrangementFilter === "SUITE") return typeName.includes("suite") || typeName.includes("family") || maxG > 2;
                      return true;
                    })
                    .map((r: any) => {
                    const isSelected = selectedRoom?.id === r.id;
                    const maxG = r.room_type?.max_guests || r.max_guests || 2;
                    const isAC = r.room_type?.is_ac ?? true;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.roomCard, isSelected && styles.roomCardSelected]}
                        onPress={() => setSelectedRoom(r)}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.roomNumber, isSelected && styles.selectedText]}>
                            {r.room_number}
                          </Text>
                          <View style={[styles.tagBadge, isAC ? styles.tagAc : styles.tagNonAc]}>
                            <Text style={styles.tagText}>{isAC ? "AC" : "Non-AC"}</Text>
                          </View>
                        </View>

                        <Text style={[styles.roomType, isSelected && styles.selectedText]} numberOfLines={1}>
                          {r.room_type?.name || "Standard Room"}
                        </Text>

                        {/* Room Capacity */}
                        <View style={styles.capacityBadge}>
                          <Users size={12} color={isSelected ? "#1d4ed8" : "#64748b"} />
                          <Text style={[styles.capacityText, isSelected && { color: "#1d4ed8" }]}>
                            Max: {maxG} {maxG === 1 ? "Guest" : "Guests"}
                          </Text>
                        </View>

                        <Text style={[styles.roomPrice, isSelected && styles.selectedText]}>
                          Rs. {Number(r.room_type?.base_nightly_rate || 0).toLocaleString()}/night
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── STEP 2: Select Guest ─────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.title}>Guest Identification & Profile</Text>
              <Text style={styles.subtitle}>Select an existing guest or quickly register a new walk-in guest with ID.</Text>
            </View>

            {/* Quick Walk-in Guest Form Toggle */}
            <TouchableOpacity
              style={styles.newGuestBtn}
              onPress={() => setShowQuickGuestModal(!showQuickGuestModal)}
            >
              <Plus size={16} color="#2563eb" />
              <Text style={styles.newGuestText}>
                {showQuickGuestModal ? "Close Walk-in Form" : "+ Register New Walk-in Guest"}
              </Text>
              <ChevronRight size={16} color="#2563eb" />
            </TouchableOpacity>

            {/* Inline Quick Guest Creation Form */}
            {showQuickGuestModal && (
              <View style={styles.quickFormBox}>
                <Text style={styles.formTitle}>New Guest Details</Text>
                
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Kasun Perera"
                  value={newGuestName}
                  onChangeText={setNewGuestName}
                />

                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+94 77 123 4567"
                  keyboardType="phone-pad"
                  value={newGuestPhone}
                  onChangeText={setNewGuestPhone}
                />

                <Text style={styles.inputLabel}>ID Document Type</Text>
                <View style={styles.idTypeRow}>
                  {ID_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.idChip, newGuestIdType === t.key && styles.idChipActive]}
                      onPress={() => setNewGuestIdType(t.key)}
                    >
                      <Text style={[styles.idChipText, newGuestIdType === t.key && styles.idChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>ID / Passport / Document Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 199428503820 or N1234567"
                  value={newGuestIdNumber}
                  onChangeText={setNewGuestIdNumber}
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={styles.saveGuestBtn}
                  onPress={handleCreateQuickGuest}
                  disabled={quickGuestMutation.isPending}
                >
                  {quickGuestMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveGuestBtnText}>✓ Save & Select Guest</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Search bar */}
            <View style={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, phone, or ID number..."
                value={guestSearch}
                onChangeText={setGuestSearch}
                returnKeyType="search"
              />
            </View>

            {loadingGuests ? (
              <ActivityIndicator style={{ marginTop: 16 }} color="#2563eb" />
            ) : (
              <View style={styles.guestList}>
                {guestItems.map((g: any) => {
                  const isSelected = selectedGuest?.id === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.guestCard, isSelected && styles.guestCardSelected]}
                      onPress={() => setSelectedGuest(g)}
                    >
                      <View style={styles.guestAvatar}>
                        <Text style={styles.guestAvatarText}>{g.full_name?.charAt(0) || "G"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.guestName, isSelected && styles.selectedText]}>
                          {g.full_name}
                        </Text>
                        <Text style={[styles.guestSub, isSelected && styles.selectedText]}>
                          📞 {g.phone || "No phone"} {g.notes ? `• ${g.notes}` : ""}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={styles.checkMark}>
                          <Text style={styles.checkMarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {guestItems.length === 0 && !loadingGuests && (
                  <View style={styles.emptyBox}>
                    <User size={28} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No registered guests match your query.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── STEP 3: Details, Attendance, Custody & Customer Signature ───── */}
        {step === 3 && (
          <View>
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.title}>Stay Attendance & Verification</Text>
              <Text style={styles.subtitle}>Set arrival & discharge times, guest count, and ID document retention.</Text>
            </View>

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

            {/* 1. Stay type */}
            <Text style={styles.fieldLabel}>Stay Type</Text>
            <View style={styles.typeRow}>
              {STAY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeCard, stayType === t.key && styles.typeCardActive]}
                  onPress={() => {
                    setStayType(t.key);
                    setDuration(t.key === "HOURLY" ? "2" : "1");
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

            {/* 2. Attendance & Discharge Timers Card */}
            <View style={styles.timingCard}>
              <View style={styles.timingHeader}>
                <Clock size={16} color="#0369a1" />
                <Text style={styles.timingTitle}>Attendance & Discharge Schedule</Text>
              </View>
              <View style={styles.timingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timingSub}>🟢 Attendance (Check-in)</Text>
                  <Text style={styles.timingValue}>
                    {formatShortTime(checkInDate)}
                  </Text>
                  <Text style={styles.timingDate}>{formatShortDate(checkInDate)}</Text>
                </View>
                <View style={styles.timingDivider} />
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  <Text style={styles.timingSub}>🔴 Discharge (Checkout)</Text>
                  <Text style={[styles.timingValue, { color: "#2563eb" }]}>
                    {formatShortTime(checkoutDate)}
                  </Text>
                  <Text style={styles.timingDate}>
                    {formatShortDate(checkoutDate, true)}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. Duration Selector */}
            <Text style={styles.fieldLabel}>
              {stayType === "HOURLY" ? "Attendance Duration (Hours)" : "Stay Duration (Days / Nights)"}
            </Text>
            <View style={styles.durationRow}>
              <TouchableOpacity
                style={styles.durationBtn}
                onPress={() => {
                  const v = Math.max(1, (parseInt(duration) || 1) - 1);
                  setDuration(String(v));
                }}
              >
                <Text style={styles.durationBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.durationInput}
                keyboardType="numeric"
                value={duration}
                onChangeText={(v) => setDuration(v)}
              />
              <TouchableOpacity
                style={styles.durationBtn}
                onPress={() => {
                  const v = (parseInt(duration) || 1) + 1;
                  setDuration(String(v));
                }}
              >
                <Text style={styles.durationBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Room Attendance / Guest Count vs Capacity */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Attending Guests Count</Text>
              <Text style={{ fontSize: 12, color: "#64748b" }}>Room Capacity: {roomMaxGuests}</Text>
            </View>
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

            {exceedsCapacity && (
              <View style={styles.capacityWarningBox}>
                <AlertCircle size={16} color="#d97706" />
                <Text style={styles.capacityWarningText}>
                  Guest count ({currentGuestCount}) exceeds room max capacity ({roomMaxGuests}). Extra guest rate may apply.
                </Text>
              </View>
            )}

            {/* 5. Front Desk ID Custody & Document Retention */}
            <Text style={styles.fieldLabel}>Security & Identification Custody</Text>
            <View style={styles.custodyBox}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.switchTitle}>📁 Keep Physical ID at Front Desk</Text>
                  <Text style={styles.switchDesc}>
                    Retain NIC/Passport in safe until final checkout settlement.
                  </Text>
                </View>
                <Switch
                  value={idRetained}
                  onValueChange={setIdRetained}
                  trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                  thumbColor={idRetained ? "#2563eb" : "#f1f5f9"}
                />
              </View>

              {idRetained && (
                <TextInput
                  style={[styles.input, { marginTop: 8, backgroundColor: "#fff" }]}
                  placeholder="Held Document Reference (e.g. NIC 199482019V / Envelope #12)"
                  value={retainedIdDoc}
                  onChangeText={setRetainedIdDoc}
                />
              )}

              {/* Customer Agreement / Signature */}
              <View style={[styles.switchRow, { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 10, marginTop: 10 }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.switchTitle}>✍️ Guest Registration & Agreement</Text>
                  <Text style={styles.switchDesc}>
                    Guest identity verified and terms acknowledged.
                  </Text>
                </View>
                <Switch
                  value={signatureConfirmed}
                  onValueChange={setSignatureConfirmed}
                  trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                  thumbColor={signatureConfirmed ? "#16a34a" : "#f1f5f9"}
                />
              </View>
            </View>

            {/* 6. Special Notes */}
            <Text style={styles.fieldLabel}>Special Notes / Vehicle Number</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: "top" }]}
              placeholder="e.g. Car WP CA-1234, early wake-up call requested"
              multiline
              value={specialNotes}
              onChangeText={setSpecialNotes}
            />

            {/* 7. Live Price Preview */}
            <TouchableOpacity style={styles.previewBtn} onPress={fetchPricingPreview} disabled={pricingLoading}>
              <Clock size={16} color="#2563eb" />
              <Text style={styles.previewBtnText}>
                {pricingLoading ? "Calculating live price..." : "Calculate Price Estimate"}
              </Text>
            </TouchableOpacity>

            {pricingLoading && <ActivityIndicator color="#2563eb" style={{ marginVertical: 12 }} />}

            {pricingPreview && !pricingLoading && (
              <View style={styles.priceCard}>
                <Text style={styles.priceCardTitle}>💰 Estimated Charges</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Room Base Charge</Text>
                  <Text style={styles.priceValue}>Rs. {Number(pricingPreview.room_charge || 0).toLocaleString()}</Text>
                </View>
                {pricingPreview.extra_guest_charge > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Extra Guest Charge</Text>
                    <Text style={styles.priceValue}>Rs. {Number(pricingPreview.extra_guest_charge).toLocaleString()}</Text>
                  </View>
                )}
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
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── FIXED BOTTOM ACTION BAR ────────────────────────────────────────── */}
      <View style={styles.fixedFooter}>
        {step === 1 && (
          <TouchableOpacity
            style={[styles.btn, { flex: 1 }, !selectedRoom && styles.btnDisabled]}
            disabled={!selectedRoom}
            onPress={() => setStep(2)}
          >
            <Text style={styles.btnText}>
              {selectedRoom ? `Continue with Room ${selectedRoom.room_number} →` : "Select a Room to Continue"}
            </Text>
          </TouchableOpacity>
        )}

        {step === 2 && (
          <View style={{ flexDirection: "row", flex: 1, gap: 12 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { flex: 1 }, !selectedGuest && styles.btnDisabled]}
              disabled={!selectedGuest}
              onPress={handleGoToDetails}
            >
              <Text style={styles.btnText}>
                {selectedGuest ? `Continue (${selectedGuest.full_name.split(" ")[0]}) →` : "Select a Guest"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={{ flexDirection: "row", flex: 1, gap: 12 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { flex: 1 }, checkInMutation.isPending && styles.btnDisabled]}
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
        )}
      </View>
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
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 110 },
  title: { fontSize: 20, fontWeight: "800", color: DARK },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },

  // Room grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  roomCard: {
    width: "47%", padding: 14, borderRadius: 14, borderWidth: 1.5,
    borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  roomCardSelected: { borderColor: BLUE, backgroundColor: "#eff6ff" },
  roomNumber: { fontSize: 20, fontWeight: "800", color: DARK },
  roomType: { fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: "500" },
  capacityBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f1f5f9", paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 6, alignSelf: "flex-start", marginTop: 6,
  },
  capacityText: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  roomPrice: { fontSize: 12, color: "#16a34a", marginTop: 6, fontWeight: "700" },
  selectedText: { color: "#1d4ed8" },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagAc: { backgroundColor: "#dbeafe" },
  tagNonAc: { backgroundColor: "#f1f5f9" },
  tagText: { fontSize: 10, fontWeight: "700", color: "#1e40af" },

  // Guest list & Quick create
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f1f5f9", borderRadius: 10, paddingHorizontal: 12, height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: DARK },
  newGuestBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 12, backgroundColor: "#eff6ff",
    borderWidth: 1, borderColor: "#bfdbfe", marginBottom: 12,
  },
  newGuestText: { flex: 1, color: BLUE, fontWeight: "700", fontSize: 14 },
  quickFormBox: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: "#bfdbfe", marginBottom: 14,
  },
  formTitle: { fontSize: 15, fontWeight: "700", color: DARK, marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: DARK,
    backgroundColor: "#f8fafc",
  },
  idTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 4 },
  idChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  idChipActive: { backgroundColor: "#dbeafe", borderColor: BLUE },
  idChipText: { fontSize: 11, color: "#475569", fontWeight: "600" },
  idChipTextActive: { color: BLUE },
  saveGuestBtn: {
    backgroundColor: BLUE, padding: 12, borderRadius: 10,
    alignItems: "center", marginTop: 14,
  },
  saveGuestBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  guestList: { gap: 8, marginBottom: 20 },
  guestCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  guestCardSelected: { borderColor: BLUE, backgroundColor: "#eff6ff" },
  guestAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#e0e7ff", alignItems: "center", justifyContent: "center",
  },
  guestAvatarText: { fontSize: 16, fontWeight: "700", color: "#4338ca" },
  guestName: { fontSize: 14, fontWeight: "700", color: DARK },
  guestSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  checkMark: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: BLUE,
    alignItems: "center", justifyContent: "center",
  },
  checkMarkText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Timing Card
  timingCard: {
    backgroundColor: "#f0f9ff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#bae6fd", marginVertical: 10,
  },
  timingHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  timingTitle: { fontSize: 13, fontWeight: "700", color: "#0369a1" },
  timingRow: { flexDirection: "row", alignItems: "center" },
  timingDivider: { width: 1, height: 40, backgroundColor: "#bae6fd" },
  timingSub: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  timingValue: { fontSize: 18, fontWeight: "800", color: DARK, marginTop: 2 },
  timingDate: { fontSize: 11, color: "#64748b" },

  // Stay type
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#334155", marginBottom: 6, marginTop: 14 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeCard: {
    flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: "#e2e8f0", backgroundColor: "#fff", alignItems: "center",
  },
  typeCardActive: { borderColor: BLUE, backgroundColor: "#eff6ff" },
  typeIcon: { fontSize: 18, marginBottom: 2 },
  typeLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  typeLabelActive: { color: "#1d4ed8" },
  typeDesc: { fontSize: 10, color: "#94a3b8", marginTop: 2, textAlign: "center" },
  typeDescActive: { color: "#3b82f6" },

  // Duration
  durationRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  durationBtn: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e8f0",
  },
  durationBtnText: { fontSize: 20, fontWeight: "700", color: "#334155" },
  durationInput: {
    flex: 1, borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 10,
    height: 44, textAlign: "center", fontSize: 18, fontWeight: "700", color: DARK, backgroundColor: "#fff",
  },

  // Capacity Warning
  capacityWarningBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1,
    padding: 10, borderRadius: 10, marginTop: 6,
  },
  capacityWarningText: { fontSize: 12, color: "#92400e", flex: 1 },

  // Custody Box
  custodyBox: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#e2e8f0", marginTop: 4,
  },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchTitle: { fontSize: 13, fontWeight: "700", color: DARK },
  switchDesc: { fontSize: 11, color: "#64748b", marginTop: 2 },

  // Summary
  summaryCard: {
    backgroundColor: "#eff6ff", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#bfdbfe", gap: 6, marginBottom: 4,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryText: { fontSize: 13, fontWeight: "600", color: "#1e40af" },

  // Price preview
  previewBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, backgroundColor: "#eff6ff", borderRadius: 10,
    borderWidth: 1, borderColor: "#bfdbfe", marginTop: 14,
  },
  previewBtnText: { color: BLUE, fontWeight: "700", fontSize: 13 },
  priceCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#e2e8f0", marginTop: 10, gap: 6,
  },
  priceCardTitle: { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 13, color: "#64748b" },
  priceValue: { fontSize: 13, fontWeight: "600", color: DARK },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 8, marginTop: 4 },
  priceTotalLabel: { fontSize: 14, fontWeight: "700", color: DARK },
  priceTotalValue: { fontSize: 16, fontWeight: "800", color: BLUE },

  // Navigation Footer
  fixedFooter: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff", paddingHorizontal: 20, paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  btn: {
    backgroundColor: BLUE, padding: 15, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  backBtn: {
    padding: 15, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1",
    alignItems: "center", justifyContent: "center", width: 90,
  },
  backBtnText: { color: "#334155", fontSize: 14, fontWeight: "600" },

  // Empty & Error states
  emptyBox: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
  refreshChip: {
    marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#eff6ff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  errorBanner: {
    backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  errorTitle: { color: "#991b1b", fontWeight: "700", fontSize: 14, marginBottom: 4 },
  errorMsg: { color: "#b91c1c", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  retryBtn: {
    alignSelf: "flex-start", backgroundColor: "#ef4444",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  retryBtnText: { color: "#ffffff", fontWeight: "600", fontSize: 12 },
});
