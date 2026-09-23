/**
 * StayFlow Mobile – New Advance Reservation Screen
 * Complete multi-room & group booking workflow:
 * - Multi-selection for rooms (book 1, 2, 3+ rooms in a single transaction)
 * - Interactive DateTime & Calendar picker for arrival & departure dates
 * - Guest count (Adults / Children) with aggregate multi-room occupancy matching
 * - Room arrangement selector (Single / Double / Twin / Suite)
 * - Real-time room availability & conflict detection for selected dates
 * - Guest registration, advance deposit, and booking source
 */
import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, Modal
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Calendar as CalendarIcon, User, BedDouble, Plus, Search,
  ChevronRight, ChevronLeft, ArrowLeft, DollarSign, Clock, Tag,
  Users, CheckCircle2, AlertCircle, X, Sparkles, Check, Layers, CreditCard
} from "lucide-react-native";
import { validateGuestId } from "@/lib/idValidation";

const SOURCES = [
  { key: "PHONE", label: "📞 Phone" },
  { key: "WHATSAPP", label: "💬 WhatsApp" },
  { key: "WALK_IN", label: "🚶 Walk-in" },
  { key: "OTA", label: "🌐 OTA / Booking.com" },
  { key: "WEBSITE", label: "💻 Direct Web" },
];

const STAY_TYPES = [
  { key: "OVERNIGHT", label: "Overnight" },
  { key: "DAY_USE", label: "Day Use" },
  { key: "HOURLY", label: "Hourly" },
];

const ROOM_ARRANGEMENTS = [
  { key: "ALL", label: "All Rooms", desc: "Show all" },
  { key: "SINGLE", label: "Single", desc: "1 Bed • 1P" },
  { key: "DOUBLE", label: "Double", desc: "King/Queen • 2P" },
  { key: "TWIN", label: "Twin Beds", desc: "2 Beds • 2P" },
  { key: "SUITE", label: "Suite / Family", desc: "Spacious • 3P+" },
];

const TIME_SLOTS = [
  "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM",
  "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatReadableDate(d: Date) {
  if (!d || isNaN(d.getTime())) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function toISODateOnly(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function to24HourTime(timeStr?: string): string | undefined {
  if (!timeStr) return undefined;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return timeStr.slice(0, 5);
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const modifier = match[3]?.toUpperCase();
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

export default function NewReservationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ── Date & Time State ──────────────────────────────────────────────────────────
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [checkInDate, setCheckInDate] = useState<Date>(now);
  const [checkInTime, setCheckInTime] = useState("02:00 PM");
  const [checkOutDate, setCheckOutDate] = useState<Date>(tomorrow);
  const [checkOutTime, setCheckOutTime] = useState("11:00 AM");

  // Date Modal State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<"checkIn" | "checkOut">("checkIn");
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());

  // ── Guests & Room Arrangement State ───────────────────────────────────────────
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [arrangementFilter, setArrangementFilter] = useState("ALL");

  const totalGuests = adults + children;

  // ── Multi-Room Selection State ────────────────────────────────────────────────
  const [selectedRooms, setSelectedRooms] = useState<any[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [stayType, setStayType] = useState("OVERNIGHT");
  const [bookingSource, setBookingSource] = useState("PHONE");
  const [advancePayment, setAdvancePayment] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [notes, setNotes] = useState("");

  // Quick Guest Form
  const [guestSearch, setGuestSearch] = useState("");
  const [showQuickGuest, setShowQuickGuest] = useState(false);
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestPhone, setNewGuestPhone] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [newGuestIdNumber, setNewGuestIdNumber] = useState("");
  const [newGuestIdType, setNewGuestIdType] = useState("NATIONAL_ID");

  const [selectedPropId, setSelectedPropId] = useState<string>("");

  // ── Data Fetching ─────────────────────────────────────────────────────────────
  const { data: propsData } = useQuery({
    queryKey: ["properties", user?.id],
    queryFn: () => api.get("/properties"),
    enabled: !!user,
  });
  const properties: any[] = propsData?.data?.data || [];
  const propertyId = user?.assigned_property_id || selectedPropId || properties[0]?.id;

  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ["rooms", propertyId],
    queryFn: () => api.get(`/rooms/by-property/${propertyId}`),
    enabled: !!propertyId,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ["all-bookings-for-availability"],
    queryFn: () => api.get("/bookings", { params: { limit: 200 } }),
  });

  const { data: guestsData, isLoading: loadingGuests } = useQuery({
    queryKey: ["guests-search", guestSearch],
    queryFn: () => api.get("/guests", { params: { search: guestSearch || undefined, limit: 20 } }),
  });

  const allRooms: any[] = roomsData?.data?.data ?? [];
  const allBookings: any[] = bookingsData?.data?.data || [];
  const guests: any[] = guestsData?.data?.data?.items ?? guestsData?.data?.data ?? [];

  // ── Calculated Duration (Nights) ──────────────────────────────────────────────
  const nightsCount = useMemo(() => {
    const start = new Date(toISODateOnly(checkInDate));
    const end = new Date(toISODateOnly(checkOutDate));
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [checkInDate, checkOutDate]);

  // ── Toggle Room Multi-Selection ───────────────────────────────────────────────
  const toggleRoomSelection = (room: any) => {
    if (room.isBooked) return;
    const exists = selectedRooms.some((r) => r.id === room.id);
    if (exists) {
      setSelectedRooms(selectedRooms.filter((r) => r.id !== room.id));
    } else {
      setSelectedRooms([...selectedRooms, room]);
    }
  };

  // ── Aggregate Selected Rooms Capacity & Rates ─────────────────────────────────
  const selectedStats = useMemo(() => {
    const totalCapacity = selectedRooms.reduce((sum, r) => sum + (r.roomCapacity || 2), 0);
    const combinedNightlyRate = selectedRooms.reduce((sum, r) => sum + Number(r.room_type?.base_nightly_rate || 0), 0);
    const combinedEstimatedTotal = combinedNightlyRate * nightsCount;
    const roomNumbersStr = selectedRooms.map((r) => `Room ${r.room_number}`).join(", ");
    return {
      count: selectedRooms.length,
      totalCapacity,
      combinedNightlyRate,
      combinedEstimatedTotal,
      roomNumbersStr,
      hasEnoughCapacity: totalCapacity >= totalGuests,
    };
  }, [selectedRooms, nightsCount, totalGuests]);

  // ── Availability & Arrangement Filtering ──────────────────────────────────────
  const { filteredRooms, bookedRoomIds } = useMemo(() => {
    const checkInStr = toISODateOnly(checkInDate);
    const checkOutStr = toISODateOnly(checkOutDate);

    // Identify rooms booked for this date range
    const bookedIds = new Set<string>();
    for (const b of allBookings) {
      if (b.status === "CANCELLED" || b.status === "NO_SHOW" || b.status === "COMPLETED") {
        continue;
      }
      const bIn = b.check_in_date?.slice(0, 10);
      const bOut = (b.expected_checkout_date || b.check_out_date)?.slice(0, 10);
      if (!bIn || !bOut) continue;

      // Overlap: NOT (bOut <= checkInStr OR bIn >= checkOutStr)
      if (!(bOut <= checkInStr || bIn >= checkOutStr)) {
        if (b.room_id) bookedIds.add(b.room_id);
      }
    }

    const todayStr = toISODateOnly(new Date());
    const isArrivalToday = checkInStr === todayStr;

    // Filter & rank rooms based on guest count & arrangement
    const matched = allRooms.map((room) => {
      const isOccupiedNow = isArrivalToday && room.status === "OCCUPIED";
      const isBooked = bookedIds.has(room.id);
      const isUnavailable = isBooked || isOccupiedNow;
      const roomCapacity = room.max_guests || room.room_type?.max_guests || 2;
      const typeName = (room.room_type?.name || "").toLowerCase();

      // Arrangement classification
      let matchesArrangement = true;
      let arrangementTag = "Double Bed";

      if (typeName.includes("single")) {
        arrangementTag = "Single Bed";
        if (arrangementFilter === "DOUBLE" || arrangementFilter === "TWIN" || arrangementFilter === "SUITE") {
          matchesArrangement = false;
        }
      } else if (typeName.includes("twin")) {
        arrangementTag = "Twin Beds";
        if (arrangementFilter === "SINGLE" || arrangementFilter === "DOUBLE" || arrangementFilter === "SUITE") {
          matchesArrangement = false;
        }
      } else if (typeName.includes("suite") || typeName.includes("family")) {
        arrangementTag = "Family Suite";
        if (arrangementFilter === "SINGLE") {
          matchesArrangement = false;
        }
      } else {
        arrangementTag = "Double / King Bed";
        if (arrangementFilter === "SINGLE" && totalGuests > 1) {
          matchesArrangement = false;
        }
      }

      if (arrangementFilter === "SINGLE" && !typeName.includes("single") && roomCapacity > 1) {
        matchesArrangement = false;
      }
      if (arrangementFilter === "DOUBLE" && !typeName.includes("double") && !typeName.includes("deluxe") && !typeName.includes("standard")) {
        matchesArrangement = false;
      }
      if (arrangementFilter === "TWIN" && !typeName.includes("twin")) {
        matchesArrangement = false;
      }
      if (arrangementFilter === "SUITE" && !typeName.includes("suite") && !typeName.includes("family")) {
        matchesArrangement = false;
      }

      const isRecommended = !isUnavailable && (totalGuests <= 2 ? arrangementTag.includes("Double") || arrangementTag.includes("Twin") : true);

      return {
        ...room,
        isBooked,
        isOccupiedNow,
        isUnavailable,
        roomCapacity,
        arrangementTag,
        matchesArrangement: arrangementFilter === "ALL" ? true : matchesArrangement,
        isRecommended,
      };
    });

    // Sort: Available first, then room number
    matched.sort((a, b) => {
      if (a.isUnavailable !== b.isUnavailable) return a.isUnavailable ? 1 : -1;
      return (a.room_number || "").localeCompare(b.room_number || "");
    });

    return { filteredRooms: matched, bookedRoomIds: bookedIds };
  }, [allRooms, allBookings, checkInDate, checkOutDate, totalGuests, arrangementFilter]);

  // ── Quick Guest Creation ──────────────────────────────────────────────────────
  const quickGuestMutation = useMutation({
    mutationFn: (data: any) => api.post("/guests", data),
    onSuccess: (res) => {
      const g = res.data?.data;
      queryClient.invalidateQueries({ queryKey: ["guests-search"] });
      setSelectedGuest(g);
      setShowQuickGuest(false);
      setNewGuestName("");
      setNewGuestPhone("");
      setNewGuestEmail("");
      Alert.alert("✅ Guest Created", `${g.full_name} has been selected.`);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.detail?.message || "Failed to create guest");
    },
  });

  // ── Create Multi-Room Reservation Mutation ───────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedRooms.length === 0) {
      Alert.alert("Rooms Required", "Please tap and select at least 1 available room.");
      return;
    }
    if (!selectedGuest) {
      Alert.alert("Guest Required", "Please select an existing guest or register a new guest.");
      return;
    }

    try {
      setIsSubmitting(true);
      const isMulti = selectedRooms.length > 1;
      const depositPerRoom = selectedRooms.length > 0 && advancePayment
        ? parseFloat(advancePayment) / selectedRooms.length
        : 0;

      const createdResNumbers: string[] = [];

      // Create reservation for each selected room
      for (let i = 0; i < selectedRooms.length; i++) {
        const room = selectedRooms[i];
        const groupNote = isMulti
          ? `[Group Booking ${i + 1}/${selectedRooms.length} - ${selectedStats.roomNumbersStr}] ${notes}`
          : notes;

        const res = await api.post("/bookings", {
          property_id: propertyId,
          room_id: room.id,
          primary_guest_id: selectedGuest.id,
          stay_type: stayType,
          check_in_date: toISODateOnly(checkInDate),
          check_in_time: to24HourTime(checkInTime),
          expected_checkout_date: toISODateOnly(checkOutDate),
          expected_checkout_time: to24HourTime(checkOutTime),
          num_guests: Math.min(room.roomCapacity || 2, totalGuests),
          booking_source: bookingSource,
          advance_payment: depositPerRoom,
          special_requests: specialRequests.trim() || undefined,
          notes: groupNote.trim() || undefined,
        });

        if (res.data?.data?.reservation_number) {
          createdResNumbers.push(res.data.data.reservation_number);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["all-bookings-for-availability"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      Alert.alert(
        "🎉 Reservations Confirmed",
        `Successfully booked ${selectedRooms.length} ${selectedRooms.length === 1 ? "room" : "rooms"} (${selectedStats.roomNumbersStr}) for ${selectedGuest?.full_name}.\n\nBooking Refs: ${createdResNumbers.join(", ")}`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Failed to create reservations";
      Alert.alert("Reservation Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Calendar Helpers ──────────────────────────────────────────────────────────
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleDaySelect = (day: number) => {
    const selected = new Date(calendarYear, calendarMonth, day, 12, 0, 0);
    if (pickingTarget === "checkIn") {
      setCheckInDate(selected);
      if (selected >= checkOutDate) {
        const nextDay = new Date(selected);
        nextDay.setDate(nextDay.getDate() + 1);
        setCheckOutDate(nextDay);
      }
    } else {
      if (selected <= checkInDate) {
        Alert.alert("Invalid Departure Date", "Departure date must be after arrival date.");
        return;
      }
      setCheckOutDate(selected);
    }
    setIsDatePickerOpen(false);
  };

  const applyPreset = (days: number) => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + days);
    setCheckInDate(start);
    setCheckOutDate(end);
    setIsDatePickerOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>New Advance Reservation</Text>
          <Text style={styles.headerSubtitle}>Multi-Room & Group Booking Support</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>

        {/* ── 1. Stay Dates & Times ───────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <CalendarIcon size={18} color="#2563eb" />
          <Text style={styles.sectionTitle}>1. Arrival & Departure Dates</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.dateSelectorRow}>
            {/* Check-In Card */}
            <TouchableOpacity
              style={styles.datePickCard}
              onPress={() => {
                setPickingTarget("checkIn");
                setCalendarMonth(checkInDate.getMonth());
                setCalendarYear(checkInDate.getFullYear());
                setIsDatePickerOpen(true);
              }}
            >
              <Text style={styles.dateSubLabel}>ARRIVE</Text>
              <Text style={styles.dateMainText}>{formatReadableDate(checkInDate)}</Text>
              <View style={styles.timeTag}>
                <Clock size={12} color="#2563eb" />
                <Text style={styles.timeTagText}>{checkInTime}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.durationBadge}>
              <Text style={styles.durationNightsText}>{nightsCount}N</Text>
              <ChevronRight size={14} color="#64748b" />
            </View>

            {/* Check-Out Card */}
            <TouchableOpacity
              style={styles.datePickCard}
              onPress={() => {
                setPickingTarget("checkOut");
                setCalendarMonth(checkOutDate.getMonth());
                setCalendarYear(checkOutDate.getFullYear());
                setIsDatePickerOpen(true);
              }}
            >
              <Text style={styles.dateSubLabel}>DEPART</Text>
              <Text style={styles.dateMainText}>{formatReadableDate(checkOutDate)}</Text>
              <View style={styles.timeTag}>
                <Clock size={12} color="#2563eb" />
                <Text style={styles.timeTagText}>{checkOutTime}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick preset buttons */}
          <View style={styles.presetsRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(1)}>
              <Text style={styles.presetChipText}>Tonight (1N)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(2)}>
              <Text style={styles.presetChipText}>2 Nights</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(3)}>
              <Text style={styles.presetChipText}>3 Nights</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(7)}>
              <Text style={styles.presetChipText}>1 Week</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. Guests & Room Arrangement ────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Users size={18} color="#2563eb" />
          <Text style={styles.sectionTitle}>2. Guests & Bedding Preferences</Text>
        </View>

        <View style={styles.card}>
          {/* Guest Count Controls */}
          <View style={styles.guestCountRow}>
            {/* Adults */}
            <View style={styles.guestCounterBox}>
              <Text style={styles.guestTypeLabel}>Adults</Text>
              <Text style={styles.guestTypeSub}>Ages 13+</Text>
              <View style={styles.counterControls}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setAdults(Math.max(1, adults - 1))}
                >
                  <Text style={styles.counterBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.counterValueText}>{adults}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setAdults(adults + 1)}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.counterDivider} />

            {/* Children */}
            <View style={styles.guestCounterBox}>
              <Text style={styles.guestTypeLabel}>Children</Text>
              <Text style={styles.guestTypeSub}>Ages 0 - 12</Text>
              <View style={styles.counterControls}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setChildren(Math.max(0, children - 1))}
                >
                  <Text style={styles.counterBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.counterValueText}>{children}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setChildren(children + 1)}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Quick guest badge */}
          <View style={styles.guestSummaryBanner}>
            <Sparkles size={14} color="#1d4ed8" />
            <Text style={styles.guestSummaryBannerText}>
              Total <Text style={{ fontWeight: "800" }}>{totalGuests} {totalGuests === 1 ? "Guest" : "Guests"}</Text> ({adults} Adults{children > 0 ? `, ${children} Children` : ""})
            </Text>
          </View>

          {/* Room Arrangement / Bed Preference Filter */}
          <Text style={[styles.label, { marginTop: 14 }]}>Filter Room Arrangement / Bed Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {ROOM_ARRANGEMENTS.map((arr) => {
                const isActive = arrangementFilter === arr.key;
                return (
                  <TouchableOpacity
                    key={arr.key}
                    style={[styles.arrangementChip, isActive && styles.arrangementChipActive]}
                    onPress={() => setArrangementFilter(arr.key)}
                  >
                    <Text style={[styles.arrangementChipText, isActive && styles.arrangementChipTextActive]}>
                      {arr.label}
                    </Text>
                    <Text style={[styles.arrangementChipDesc, isActive && { color: "#bfdbfe" }]}>
                      {arr.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* ── 3. Multi-Room Selection ─────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Layers size={18} color="#2563eb" />
          <Text style={styles.sectionTitle}>
            3. Select Rooms ({selectedRooms.length} Selected)
          </Text>
        </View>

        {/* Multi-Room Selection Summary Banner */}
        {selectedRooms.length > 0 && (
          <View style={styles.selectionSummaryCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <Text style={styles.selectionSummaryTitle}>
                  {selectedRooms.length} {selectedRooms.length === 1 ? "Room" : "Rooms"} Selected ({selectedStats.roomNumbersStr})
                </Text>
              </View>
              <Text style={styles.selectionSummarySub}>
                Combined Capacity: <Text style={{ fontWeight: "700" }}>{selectedStats.totalCapacity} Guests</Text>
                {selectedStats.hasEnoughCapacity
                  ? " (✓ Fits all guests)"
                  : ` (⚠️ Need capacity for ${totalGuests} guests, select more rooms)`}
              </Text>
              <Text style={styles.selectionSummaryPrice}>
                Combined Rate: Rs. {selectedStats.combinedNightlyRate.toLocaleString()}/n • Total: Rs. {selectedStats.combinedEstimatedTotal.toLocaleString()} ({nightsCount}N)
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedRooms([])} style={styles.clearRoomsBtn}>
              <Text style={styles.clearRoomsBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {loadingRooms ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2563eb" size="small" />
            <Text style={styles.loadingText}>Checking live room availability...</Text>
          </View>
        ) : filteredRooms.length === 0 ? (
          <View style={styles.emptyRoomsBox}>
            <AlertCircle size={28} color="#94a3b8" />
            <Text style={styles.emptyRoomsTitle}>No Rooms Available</Text>
            <Text style={styles.emptyRoomsSub}>No rooms match the selected arrangement and dates.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredRooms
              .filter((r) => r.matchesArrangement)
              .map((room) => {
                const isSelected = selectedRooms.some((r) => r.id === room.id);
                const isUnavailable = room.isUnavailable;
                const isOccupiedNow = room.isOccupiedNow;
                const isBooked = room.isBooked;
                const nightlyRate = Number(room.room_type?.base_nightly_rate || 0);
                const estimatedTotal = nightlyRate * nightsCount;

                return (
                  <TouchableOpacity
                    key={room.id}
                    disabled={isUnavailable}
                    style={[
                      styles.roomCardFull,
                      isSelected && styles.roomCardFullSelected,
                      isUnavailable && styles.roomCardFullDisabled,
                    ]}
                    onPress={() => toggleRoomSelection(room)}
                  >
                    <View style={styles.roomCardTop}>
                      <View style={styles.roomCardLeftInfo}>
                        {/* Checkbox indicator */}
                        <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleSelected]}>
                          {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                        </View>

                        <View style={[styles.roomNumberCircle, isSelected && { backgroundColor: "#2563eb" }]}>
                          <Text style={[styles.roomNumberCircleText, isSelected && { color: "#fff" }]}>
                            {room.room_number}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.roomTypeName} numberOfLines={1}>
                            {room.room_type?.name || "Standard Room"}
                          </Text>
                          <Text style={styles.roomSubInfo} numberOfLines={1}>
                            Floor {room.floor || "1"} • {room.arrangementTag} {room.room_type?.is_ac ? "• ❄️ AC" : "• Non-AC"}
                          </Text>
                        </View>
                      </View>

                      {/* Status / Availability Badge */}
                      {isOccupiedNow ? (
                        <View style={styles.bookedBadge}>
                          <Text style={styles.bookedBadgeText}>⛔ Occupied</Text>
                        </View>
                      ) : isBooked ? (
                        <View style={styles.bookedBadge}>
                          <Text style={styles.bookedBadgeText}>⛔ Reserved</Text>
                        </View>
                      ) : isSelected ? (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>✓ Selected</Text>
                        </View>
                      ) : (
                        <View style={styles.availableBadge}>
                          <Text style={styles.availableBadgeText}>Available</Text>
                        </View>
                      )}
                    </View>

                    {/* Room Details & Price */}
                    <View style={styles.roomCardBottom}>
                      <View style={styles.capacityRow}>
                        <Users size={14} color="#64748b" />
                        <Text style={styles.capacityText}>Max {room.roomCapacity} Guests</Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.roomNightlyPrice}>
                          Rs. {nightlyRate.toLocaleString()}{" "}
                          <Text style={{ fontSize: 11, fontWeight: "500", color: "#64748b" }}>/ night</Text>
                        </Text>
                        <Text style={styles.roomEstTotal}>
                          Est: Rs. {estimatedTotal.toLocaleString()} ({nightsCount}N)
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {/* ── 4. Guest Details ────────────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <User size={18} color="#2563eb" />
          <Text style={styles.sectionTitle}>4. Primary Booker / Guest Details</Text>
        </View>

        <View style={styles.card}>
          {selectedGuest ? (
            <View style={styles.selectedGuestBox}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={16} color="#16a34a" />
                  <Text style={styles.selectedGuestName}>{selectedGuest.full_name}</Text>
                </View>
                <Text style={styles.selectedGuestSub}>
                  📞 {selectedGuest.phone || "No phone"} {selectedGuest.email ? `• ${selectedGuest.email}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedGuest(null)}>
                <Text style={styles.changeGuestText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.searchBox}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search existing guests by name or phone..."
                  value={guestSearch}
                  onChangeText={setGuestSearch}
                />
              </View>

              <TouchableOpacity
                style={styles.quickGuestToggle}
                onPress={() => setShowQuickGuest(!showQuickGuest)}
              >
                <Plus size={15} color="#2563eb" />
                <Text style={styles.quickGuestToggleText}>
                  {showQuickGuest ? "Hide New Guest Form" : "+ Register New Guest"}
                </Text>
              </TouchableOpacity>

              {showQuickGuest && (
                <View style={styles.quickGuestForm}>
                  <Text style={styles.quickGuestTitle}>Quick Guest Registration</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name *"
                    value={newGuestName}
                    onChangeText={setNewGuestName}
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="Phone Number (e.g. 0771234567)"
                    keyboardType="phone-pad"
                    value={newGuestPhone}
                    onChangeText={setNewGuestPhone}
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="Email Address (Optional)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newGuestEmail}
                    onChangeText={setNewGuestEmail}
                  />

                  {/* ID Document & Live Verification */}
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                      {["NATIONAL_ID", "PASSPORT", "DRIVING_LICENSE"].map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.idTypeChip,
                            newGuestIdType === t && styles.idTypeChipActive
                          ]}
                          onPress={() => setNewGuestIdType(t)}
                        >
                          <Text style={[
                            styles.idTypeChipText,
                            newGuestIdType === t && styles.idTypeChipTextActive
                          ]}>
                            {t === "NATIONAL_ID" ? "NIC" : t === "PASSPORT" ? "Passport" : "License"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      style={[
                        styles.input,
                        newGuestIdNumber.trim()
                          ? (validateGuestId(newGuestIdType, newGuestIdNumber).isValid
                              ? { borderColor: "#86efac", backgroundColor: "#f0fdf4" }
                              : { borderColor: "#fca5a5", backgroundColor: "#fef2f2" })
                          : undefined
                      ]}
                      placeholder={newGuestIdType === "NATIONAL_ID" ? "ID Number (e.g. 981234567V)" : "Document Number"}
                      value={newGuestIdNumber}
                      onChangeText={setNewGuestIdNumber}
                      autoCapitalize="characters"
                    />

                    {/* Decoded Info */}
                    {newGuestIdNumber.trim() !== "" && (() => {
                      const v = validateGuestId(newGuestIdType, newGuestIdNumber);
                      if (v.isValid && v.dobFormatted) {
                        return (
                          <View style={styles.quickIdBadge}>
                            <Sparkles size={13} color="#15803d" />
                            <Text style={styles.quickIdBadgeText}>
                              🎂 {v.dobFormatted} • {v.gender} • {v.age} yrs
                            </Text>
                          </View>
                        );
                      }
                      if (!v.isValid && v.errorMessage) {
                        return (
                          <Text style={styles.quickIdErrorText}>
                            ⚠️ {v.errorMessage}
                          </Text>
                        );
                      }
                      return null;
                    })()}
                  </View>

                  <TouchableOpacity
                    style={styles.saveGuestBtn}
                    onPress={() => {
                      if (!newGuestName.trim()) {
                        Alert.alert("Required", "Please provide guest full name.");
                        return;
                      }

                      const v = newGuestIdNumber.trim()
                        ? validateGuestId(newGuestIdType, newGuestIdNumber)
                        : null;

                      if (v && !v.isValid) {
                        Alert.alert("Invalid ID", v.errorMessage || "Please enter a valid ID number.");
                        return;
                      }

                      const payload: any = {
                        full_name: newGuestName.trim(),
                        phone: newGuestPhone.trim() || undefined,
                        email: newGuestEmail.trim() || undefined,
                        date_of_birth: v?.dob || undefined,
                      };

                      if (newGuestIdNumber.trim()) {
                        payload.notes = `[ID: ${newGuestIdType} - ${newGuestIdNumber.trim()}${v?.gender ? ` | ${v.gender}` : ""}]`;
                      }

                      quickGuestMutation.mutate(payload);
                    }}
                    disabled={quickGuestMutation.isPending}
                  >
                    {quickGuestMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveGuestBtnText}>Save & Select Guest</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Suggestions */}
              {guests.slice(0, 4).map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.guestItem}
                  onPress={() => setSelectedGuest(g)}
                >
                  <Text style={styles.guestItemName}>{g.full_name}</Text>
                  <Text style={styles.guestItemSub}>📞 {g.phone || g.email || "No contact info"}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* ── 5. Booking Source & Advance Payment ─────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Tag size={18} color="#2563eb" />
          <Text style={styles.sectionTitle}>5. Channel & Advance Payment</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Booking Channel / Source</Text>
          <View style={styles.chipsWrap}>
            {SOURCES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.chip, bookingSource === s.key && styles.chipActive]}
                onPress={() => setBookingSource(s.key)}
              >
                <Text style={[styles.chipText, bookingSource === s.key && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>Total Advance Deposit Paid (LKR / Rs.)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00 (leave empty if unconfirmed/pay at desk)"
            keyboardType="numeric"
            value={advancePayment}
            onChangeText={setAdvancePayment}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Special Requests / Group Notes</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: "top" }]}
            placeholder="e.g. Group booking for wedding, adjacent rooms requested"
            multiline
            value={specialRequests}
            onChangeText={setSpecialRequests}
          />
        </View>
      </ScrollView>

      {/* ── Fixed Bottom Bar ─────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerInfoTitle}>
            {selectedRooms.length === 0
              ? "Select Rooms to Book"
              : `${selectedRooms.length} ${selectedRooms.length === 1 ? "Room" : "Rooms"} (${selectedStats.roomNumbersStr})`}
          </Text>
          <Text style={styles.footerInfoSub}>
            {totalGuests} Guests • {nightsCount}N {selectedRooms.length > 0 ? `• Total: Rs. ${selectedStats.combinedEstimatedTotal.toLocaleString()}` : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, (selectedRooms.length === 0 || !selectedGuest || isSubmitting) && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={selectedRooms.length === 0 || !selectedGuest || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              Confirm {selectedRooms.length > 1 ? `${selectedRooms.length} Rooms` : "Booking"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Date & Time Picker Modal ─────────────────────────────────────────── */}
      <Modal visible={isDatePickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Select {pickingTarget === "checkIn" ? "Arrival Date & Time" : "Departure Date & Time"}
                </Text>
                <Text style={styles.modalSubTitle}>
                  {pickingTarget === "checkIn" ? "When will the group arrive?" : "When will the group check out?"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsDatePickerOpen(false)} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Month Navigation */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                >
                  <ChevronLeft size={20} color="#334155" />
                </TouchableOpacity>

                <Text style={styles.monthNavTitle}>
                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                </Text>

                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                >
                  <ChevronRight size={20} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* Day Headers */}
              <View style={styles.calendarDaysGrid}>
                {DAY_NAMES.map((d, i) => (
                  <View key={i} style={styles.dayHeaderCell}>
                    <Text style={styles.dayHeaderText}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.calendarGrid}>
                {Array.from({ length: firstDayOfMonth(calendarYear, calendarMonth) }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.dayCellEmpty} />
                ))}

                {Array.from({ length: daysInMonth(calendarYear, calendarMonth) }).map((_, i) => {
                  const day = i + 1;
                  const cellDate = new Date(calendarYear, calendarMonth, day);
                  const isPast = cellDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());

                  const isCheckIn = cellDate.toDateString() === checkInDate.toDateString();
                  const isCheckOut = cellDate.toDateString() === checkOutDate.toDateString();
                  const isInRange = cellDate > checkInDate && cellDate < checkOutDate;

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      disabled={isPast && pickingTarget === "checkIn"}
                      style={[
                        styles.dayCell,
                        isInRange && styles.dayCellInRange,
                        (isCheckIn || isCheckOut) && styles.dayCellSelected,
                        isPast && pickingTarget === "checkIn" && styles.dayCellDisabled,
                      ]}
                      onPress={() => handleDaySelect(day)}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          isInRange && styles.dayCellTextInRange,
                          (isCheckIn || isCheckOut) && styles.dayCellTextSelected,
                          isPast && pickingTarget === "checkIn" && styles.dayCellTextDisabled,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time Selector */}
              <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>
                {pickingTarget === "checkIn" ? "Check-In Expected Time" : "Checkout Expected Time"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {TIME_SLOTS.map((t) => {
                    const isSelected = (pickingTarget === "checkIn" ? checkInTime : checkOutTime) === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.timeSlotChip, isSelected && styles.timeSlotChipActive]}
                        onPress={() => {
                          if (pickingTarget === "checkIn") setCheckInTime(t);
                          else setCheckOutTime(t);
                        }}
                      >
                        <Text style={[styles.timeSlotChipText, isSelected && styles.timeSlotChipTextActive]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setIsDatePickerOpen(false)}>
                <Text style={styles.modalDoneBtnText}>Confirm Selected Date & Time</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: "#f1f5f9" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 11, color: "#64748b", marginTop: 1 },
  content: { flex: 1 },

  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 16, marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  label: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 4 },

  // Date selectors
  dateSelectorRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  datePickCard: {
    flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: "#e2e8f0",
  },
  dateSubLabel: { fontSize: 10, fontWeight: "800", color: "#64748b", letterSpacing: 0.5 },
  dateMainText: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginTop: 4, marginBottom: 6 },
  timeTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#eff6ff", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, alignSelf: "flex-start",
  },
  timeTagText: { fontSize: 11, fontWeight: "700", color: "#2563eb" },
  durationBadge: {
    paddingHorizontal: 8, alignItems: "center", justifyContent: "center",
  },
  durationNightsText: { fontSize: 12, fontWeight: "800", color: "#2563eb", marginBottom: 2 },
  presetsRow: {
    flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "#f1f5f9",
  },
  presetChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  presetChipText: { fontSize: 11, fontWeight: "700", color: "#475569" },

  // Guest Counters
  guestCountRow: { flexDirection: "row", alignItems: "center" },
  guestCounterBox: { flex: 1, alignItems: "center" },
  guestTypeLabel: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  guestTypeSub: { fontSize: 10, color: "#64748b", marginBottom: 6 },
  counterControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  counterBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: "#eff6ff",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#bfdbfe",
  },
  counterBtnText: { fontSize: 18, fontWeight: "800", color: "#2563eb" },
  counterValueText: { fontSize: 16, fontWeight: "800", color: "#0f172a", minWidth: 20, textAlign: "center" },
  counterDivider: { width: 1, height: 44, backgroundColor: "#e2e8f0" },
  guestSummaryBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#eff6ff", padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "#bfdbfe", marginTop: 12,
  },
  guestSummaryBannerText: { fontSize: 12, color: "#1e40af" },

  // Arrangement Chips
  arrangementChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
  },
  arrangementChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  arrangementChipText: { fontSize: 12, fontWeight: "800", color: "#334155" },
  arrangementChipTextActive: { color: "#fff" },
  arrangementChipDesc: { fontSize: 10, color: "#64748b", marginTop: 2 },

  // Selection summary
  selectionSummaryCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#eff6ff", borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: "#bfdbfe", marginBottom: 10,
  },
  selectionSummaryTitle: { fontSize: 13, fontWeight: "800", color: "#1e40af" },
  selectionSummarySub: { fontSize: 12, color: "#3b82f6", marginTop: 2 },
  selectionSummaryPrice: { fontSize: 12, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  clearRoomsBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#fee2e2" },
  clearRoomsBtnText: { fontSize: 12, fontWeight: "700", color: "#dc2626" },

  // Room Cards
  loadingBox: { padding: 20, alignItems: "center", gap: 6 },
  loadingText: { fontSize: 12, color: "#64748b" },
  emptyRoomsBox: {
    backgroundColor: "#fff", padding: 24, borderRadius: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", gap: 6,
  },
  emptyRoomsTitle: { fontSize: 15, fontWeight: "700", color: "#334155" },
  emptyRoomsSub: { fontSize: 12, color: "#94a3b8", textAlign: "center" },
  roomCardFull: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: "#e2e8f0", gap: 10,
  },
  roomCardFullSelected: { borderColor: "#2563eb", backgroundColor: "#f0f7ff" },
  roomCardFullDisabled: { opacity: 0.55, backgroundColor: "#f8fafc" },
  roomCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  roomCardLeftInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  checkboxCircle: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#cbd5e1",
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  checkboxCircleSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  roomNumberCircle: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#cbd5e1",
  },
  roomNumberCircleText: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  roomTypeName: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  roomSubInfo: { fontSize: 11, color: "#64748b", marginTop: 1 },
  availableBadge: {
    backgroundColor: "#f0fdf4", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: "#bbf7d0",
  },
  availableBadgeText: { fontSize: 10, fontWeight: "700", color: "#166534" },
  selectedBadge: {
    backgroundColor: "#2563eb", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  selectedBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  bookedBadge: {
    backgroundColor: "#fef2f2", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: "#fecaca",
  },
  bookedBadgeText: { fontSize: 10, fontWeight: "700", color: "#991b1b" },
  roomCardBottom: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9",
  },
  capacityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  capacityText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  roomNightlyPrice: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  roomEstTotal: { fontSize: 11, color: "#2563eb", fontWeight: "700", marginTop: 1 },

  // Guests
  selectedGuestBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#eff6ff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe",
  },
  selectedGuestName: { fontSize: 14, fontWeight: "800", color: "#1e40af" },
  selectedGuestSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  changeGuestText: { color: "#ef4444", fontWeight: "700", fontSize: 12 },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f1f5f9",
    borderRadius: 8, paddingHorizontal: 10, height: 38, marginBottom: 8,
  },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 13, color: "#0f172a" },
  quickGuestToggle: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, marginBottom: 6,
  },
  quickGuestToggleText: { fontSize: 13, color: "#2563eb", fontWeight: "700" },
  quickGuestForm: {
    backgroundColor: "#f8fafc", padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "#cbd5e1", marginBottom: 10,
  },
  quickGuestTitle: { fontSize: 12, fontWeight: "800", color: "#334155", marginBottom: 8 },
  idTypeChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  idTypeChipActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  idTypeChipText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  idTypeChipTextActive: { color: "#1d4ed8" },
  quickIdBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 5,
  },
  quickIdBadgeText: { fontSize: 11, fontWeight: "700", color: "#15803d" },
  quickIdErrorText: { fontSize: 11, fontWeight: "600", color: "#b91c1c", marginTop: 4 },
  saveGuestBtn: {
    backgroundColor: "#2563eb", padding: 10, borderRadius: 8, alignItems: "center", marginTop: 10,
  },
  saveGuestBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  guestItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  guestItemName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  guestItemSub: { fontSize: 11, color: "#64748b" },

  // Chips & inputs
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  chipActive: { backgroundColor: "#dbeafe", borderColor: "#2563eb" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  chipTextActive: { color: "#2563eb", fontWeight: "700" },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
    backgroundColor: "#f8fafc", color: "#0f172a",
  },

  // Footer
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 30 : 14,
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  footerInfo: { flex: 1, paddingRight: 10 },
  footerInfoTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  footerInfoSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  submitBtn: {
    backgroundColor: "#2563eb", paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 10, alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  calendarModalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 20, maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  modalSubTitle: { fontSize: 12, color: "#64748b", marginTop: 1 },
  closeBtn: { padding: 4 },
  monthNavRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 12, paddingHorizontal: 6,
  },
  navArrowBtn: {
    padding: 6, borderRadius: 8, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  monthNavTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  calendarDaysGrid: { flexDirection: "row", marginBottom: 6 },
  dayHeaderCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
  dayHeaderText: { fontSize: 11, fontWeight: "700", color: "#94a3b8" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCellEmpty: { width: `${100 / 7}%`, height: 38 },
  dayCell: {
    width: `${100 / 7}%`, height: 38, alignItems: "center", justifyContent: "center",
    borderRadius: 8, marginVertical: 2,
  },
  dayCellInRange: { backgroundColor: "#eff6ff" },
  dayCellSelected: { backgroundColor: "#2563eb" },
  dayCellDisabled: { opacity: 0.25 },
  dayCellText: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  dayCellTextInRange: { color: "#2563eb", fontWeight: "700" },
  dayCellTextSelected: { color: "#fff", fontWeight: "800" },
  dayCellTextDisabled: { color: "#94a3b8" },

  timeSlotChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  timeSlotChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  timeSlotChipText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  timeSlotChipTextActive: { color: "#fff", fontWeight: "700" },
  modalDoneBtn: {
    backgroundColor: "#2563eb", padding: 14, borderRadius: 12,
    alignItems: "center", marginTop: 8,
  },
  modalDoneBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
