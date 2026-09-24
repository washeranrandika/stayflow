import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Image, Platform
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckCircle, Users, Clock, Wrench, TrendingUp, ChevronRight,
  Plus, Calendar, BedDouble, UserPlus, LogOut, ArrowRight,
  Sparkles, RefreshCw, ShieldCheck
} from "lucide-react-native";

const ROOM_STATUS_COLORS: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  AVAILABLE:    { bg: "#f0fdf4", text: "#15803d", label: "Available", icon: "🟢" },
  OCCUPIED:     { bg: "#fef2f2", text: "#b91c1c", label: "Occupied", icon: "🔴" },
  RESERVED:     { bg: "#eff6ff", text: "#1d4ed8", label: "Reserved", icon: "🔵" },
  CLEANING:     { bg: "#fffbeb", text: "#b45309", label: "Cleaning", icon: "🧹" },
  MAINTENANCE:  { bg: "#fff7ed", text: "#c2410c", label: "Maintenance", icon: "🔧" },
  OUT_OF_SERVICE: { bg: "#f8fafc", text: "#475569", label: "Out of Service", icon: "⛔" },
};

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const selectedPropertyId = useAuthStore((s) => s.selectedPropertyId);
  const setSelectedPropertyId = useAuthStore((s) => s.setSelectedPropertyId);
  const insets = useSafeAreaInsets();

  const assignedPropId = user?.assigned_property_id;
  const isAssignedToSingleProperty = !!assignedPropId;
  const activePropertyId = isAssignedToSingleProperty ? assignedPropId : (selectedPropertyId || "all");

  const { data: propsData } = useQuery({
    queryKey: ["properties", user?.id],
    queryFn: async () => {
      const res = await api.get("/properties");
      return res.data?.data || [];
    },
    enabled: !!user,
  });

  const properties: any[] = Array.isArray(propsData) ? propsData : [];
  const currentProperty = properties.find((p) => p.id === activePropertyId);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", activePropertyId],
    queryFn: () =>
      api.get("/reports/dashboard", {
        params: activePropertyId !== "all" ? { property_id: activePropertyId } : {},
      }),
    refetchInterval: 60_000,
  });

  const getErrorMessage = (err: any) => {
    if (!err) return null;
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (err.message) return err.message;
    return "Failed to load dashboard data.";
  };

  const stats = data?.data?.data;
  const roomStatus = stats?.room_status || {};
  const totalRooms = Object.values(roomStatus).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0) as number;
  const occupiedCount = Number(roomStatus["OCCUPIED"] || 0);
  const occupancyPercent = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* ── Fixed Brand Header with Logo & Safe Area Inset ───────────────── */}
      <View style={[styles.fixedHeader, { paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 12 : 8) }]}>
        <View style={styles.logoRow}>
          <Image
            source={require("../../assets/icon.jpg")}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <View style={styles.brandTextContainer}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.brandName}>StayFlow</Text>
              <View style={styles.pmsBadge}>
                <Text style={styles.pmsBadgeText}>PMS</Text>
              </View>
            </View>
            <Text style={styles.propertySubtitle}>
              {isAssignedToSingleProperty
                ? `📍 ${user?.assigned_property_name || "Assigned Branch"}`
                : currentProperty
                ? `📍 ${currentProperty.name}`
                : "🌐 All Hotel Properties"}
            </Text>
          </View>
        </View>

        {/* User avatar / badge */}
        <TouchableOpacity
          style={styles.userBadge}
          onPress={() => router.push("/profile" as any)}
          activeOpacity={0.75}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.full_name || "U").slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Property Switcher bar for multi-property owners */}
      {!isAssignedToSingleProperty && properties.length > 1 && (
        <View style={{ backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <TouchableOpacity
              onPress={() => setSelectedPropertyId("all")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                backgroundColor: activePropertyId === "all" ? "#2563eb" : "#f1f5f9",
                borderWidth: 1,
                borderColor: activePropertyId === "all" ? "#2563eb" : "#e2e8f0",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: activePropertyId === "all" ? "#ffffff" : "#475569" }}>
                🌐 All Properties
              </Text>
            </TouchableOpacity>
            {properties.map((p: any) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPropertyId(p.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 20,
                  backgroundColor: activePropertyId === p.id ? "#2563eb" : "#f1f5f9",
                  borderWidth: 1,
                  borderColor: activePropertyId === p.id ? "#2563eb" : "#e2e8f0",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: activePropertyId === p.id ? "#ffffff" : "#475569" }}>
                  📍 {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Scrollable Dashboard Content ─────────────────────────────────── */}
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* ── Welcome Greeting ──────────────────────────────────────────────── */}
        <View style={styles.welcomeBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>
              Good {getTimeOfDay()}, {user?.full_name?.split(" ")[0] || "Staff"} 👋
            </Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.greenDot} />
            <Text style={styles.liveText}>Live Sync</Text>
          </View>
        </View>

      {/* Error Banner */}
      {isError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>⚠️ Error Loading Dashboard</Text>
          <Text style={styles.errorMsg}>{getErrorMessage(error)}</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Tap to Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Primary Quick Actions ─────────────────────────────────────────── */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={[styles.primaryActionCard, { backgroundColor: "#2563eb" }]}
          onPress={() => router.push("/check-in")}
        >
          <View style={styles.actionIconCircle}>
            <Plus size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitlePrimary}>Quick Check-In</Text>
            <Text style={styles.actionSubPrimary}>Walk-in guest check-in</Text>
          </View>
          <ChevronRight size={18} color="#93c5fd" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryActionCard, { backgroundColor: "#0f172a" }]}
          onPress={() => router.push("/new-reservation" as any)}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: "#334155" }]}>
            <Calendar size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitlePrimary}>New Reservation</Text>
            <Text style={styles.actionSubPrimary}>Advance & group booking</Text>
          </View>
          <ChevronRight size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* ── Today's Operations KPI Strip ─────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <TrendingUp size={16} color="#0f172a" />
        <Text style={styles.sectionTitle}>Today's Overview</Text>
      </View>

      <View style={styles.kpiGrid}>
        {/* Occupancy */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Occupancy</Text>
          <Text style={[styles.kpiValue, { color: occupancyPercent > 70 ? "#16a34a" : "#2563eb" }]}>
            {occupancyPercent}%
          </Text>
          <Text style={styles.kpiSub}>{occupiedCount} of {totalRooms || "—"} rooms</Text>
        </View>

        {/* Check-ins */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Check-ins</Text>
          <Text style={styles.kpiValue}>{stats?.todays_check_ins || 0}</Text>
          <Text style={styles.kpiSub}>Arrivals today</Text>
        </View>

        {/* Check-outs */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Check-outs</Text>
          <Text style={styles.kpiValue}>{stats?.todays_check_outs || 0}</Text>
          <Text style={styles.kpiSub}>Departures</Text>
        </View>
      </View>

      {/* Today's Revenue Highlight */}
      <View style={styles.revenueCard}>
        <View style={styles.revenueIconBox}>
          <TrendingUp size={22} color="#15803d" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.revenueLabel}>Today's Revenue Collected</Text>
          <Text style={styles.revenueValue}>
            LKR {(stats?.todays_revenue || 0).toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.viewBookingsBtn}
          onPress={() => router.push("/(tabs)/bookings")}
        >
          <Text style={styles.viewBookingsBtnText}>View Stays</Text>
          <ArrowRight size={12} color="#15803d" />
        </TouchableOpacity>
      </View>

      {/* ── Room Status Overview ─────────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <BedDouble size={16} color="#0f172a" />
        <Text style={styles.sectionTitle}>Live Room Inventory</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/rooms")} style={{ marginLeft: "auto" }}>
          <Text style={styles.seeAllText}>See All Rooms →</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#2563eb" style={{ marginVertical: 20 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          {Object.entries(ROOM_STATUS_COLORS).map(([status, colors]) => (
            <TouchableOpacity
              key={status}
              style={[styles.statusCard, { backgroundColor: colors.bg }]}
              onPress={() => router.push("/(tabs)/rooms")}
            >
              <Text style={styles.statusEmoji}>{colors.icon}</Text>
              <Text style={[styles.statusCount, { color: colors.text }]}>
                {roomStatus[status] || 0}
              </Text>
              <Text style={[styles.statusLabel, { color: colors.text }]}>{colors.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Operational Navigation Grid ─────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Sparkles size={16} color="#0f172a" />
        <Text style={styles.sectionTitle}>Management Modules</Text>
      </View>

      <View style={styles.moduleGrid}>
        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => router.push("/checkout")}
        >
          <View style={[styles.moduleIconBox, { backgroundColor: "#fef2f2" }]}>
            <LogOut size={20} color="#dc2626" />
          </View>
          <Text style={styles.moduleTitle}>Checkout & Folio</Text>
          <Text style={styles.moduleSub}>Settle guest bills</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => router.push("/housekeeping")}
        >
          <View style={[styles.moduleIconBox, { backgroundColor: "#fffbeb" }]}>
            <Wrench size={20} color="#b45309" />
          </View>
          <Text style={styles.moduleTitle}>Housekeeping</Text>
          <Text style={styles.moduleSub}>Cleaning & tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => router.push("/(tabs)/guests")}
        >
          <View style={[styles.moduleIconBox, { backgroundColor: "#f0fdfa" }]}>
            <Users size={20} color="#0d9488" />
          </View>
          <Text style={styles.moduleTitle}>Guests Directory</Text>
          <Text style={styles.moduleSub}>Search & histories</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => router.push("/new-guest" as any)}
        >
          <View style={[styles.moduleIconBox, { backgroundColor: "#f5f3ff" }]}>
            <UserPlus size={20} color="#7c3aed" />
          </View>
          <Text style={styles.moduleTitle}>Register Guest</Text>
          <Text style={styles.moduleSub}>New guest profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40 },

  // Fixed Brand Header
  fixedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  scrollBody: {
    flex: 1,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoImage: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  brandTextContainer: { justifyContent: "center" },
  brandName: { fontSize: 20, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  pmsBadge: {
    backgroundColor: "#2563eb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  pmsBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  propertySubtitle: { fontSize: 11, color: "#64748b", marginTop: 1 },
  userBadge: { padding: 2 },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#eff6ff", borderWidth: 1.5, borderColor: "#bfdbfe",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "800", color: "#1d4ed8" },

  // Welcome banner
  welcomeBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 14,
  },
  greetingText: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  dateText: { fontSize: 12, color: "#64748b", marginTop: 2 },
  liveIndicator: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#f0fdf4", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: "#bbf7d0",
  },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#16a34a" },
  liveText: { fontSize: 10, fontWeight: "700", color: "#166534" },

  // Quick Action Buttons
  quickActionsContainer: { gap: 10, marginBottom: 16 },
  primaryActionCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
    elevation: 2,
  },
  actionIconCircle: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  actionTitlePrimary: { fontSize: 15, fontWeight: "800", color: "#fff" },
  actionSubPrimary: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 1 },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 10, marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  seeAllText: { fontSize: 12, fontWeight: "700", color: "#2563eb" },

  // KPI Grid
  kpiGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  kpiCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  kpiLabel: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  kpiValue: { fontSize: 22, fontWeight: "900", color: "#0f172a", marginVertical: 2 },
  kpiSub: { fontSize: 10, color: "#94a3b8" },

  // Revenue Card
  revenueCard: {
    backgroundColor: "#f0fdf4", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#bbf7d0", marginBottom: 16,
  },
  revenueIconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: "#dcfce7",
    alignItems: "center", justifyContent: "center",
  },
  revenueLabel: { fontSize: 11, fontWeight: "700", color: "#15803d" },
  revenueValue: { fontSize: 18, fontWeight: "900", color: "#14532d", marginTop: 2 },
  viewBookingsBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#dcfce7", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  viewBookingsBtnText: { fontSize: 11, fontWeight: "700", color: "#15803d" },

  // Room Status Horizontal Scroll
  hScroll: { marginHorizontal: -4, marginBottom: 16 },
  statusCard: {
    width: 100, borderRadius: 12, padding: 12, marginHorizontal: 4,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
  },
  statusEmoji: { fontSize: 16, marginBottom: 4 },
  statusCount: { fontSize: 22, fontWeight: "900" },
  statusLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  // Management Module Grid
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moduleCard: {
    width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#e2e8f0", gap: 6,
  },
  moduleIconBox: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  moduleTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  moduleSub: { fontSize: 11, color: "#64748b" },

  // Error Card
  errorCard: {
    backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  errorTitle: { color: "#991b1b", fontWeight: "700", fontSize: 14, marginBottom: 4 },
  errorMsg: { color: "#b91c1c", fontSize: 12, marginBottom: 10 },
  retryBtn: {
    backgroundColor: "#ef4444", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 6, alignSelf: "flex-start",
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
