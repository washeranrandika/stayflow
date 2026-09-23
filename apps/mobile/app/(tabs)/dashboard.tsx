import React, { useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { CheckCircle, Users, Clock, Wrench, TrendingUp, ChevronRight, Plus, LogOut, UserPlus } from "lucide-react-native";

const ROOM_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  AVAILABLE:    { bg: "#f0fdf4", text: "#15803d", label: "Available" },
  OCCUPIED:     { bg: "#fef2f2", text: "#b91c1c", label: "Occupied" },
  RESERVED:     { bg: "#eff6ff", text: "#1d4ed8", label: "Reserved" },
  CLEANING:     { bg: "#fffbeb", text: "#b45309", label: "Cleaning" },
  MAINTENANCE:  { bg: "#fff7ed", text: "#c2410c", label: "Maintenance" },
  OUT_OF_SERVICE: { bg: "#f8fafc", text: "#475569", label: "Out of Service" },
};

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/reports/dashboard"),
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

  const handleForceLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const stats = data?.data?.data;
  const roomStatus = stats?.room_status || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Greeting */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>
            Good {getTimeOfDay()}, {user?.full_name?.split(" ")[0] || "there"} 👋
          </Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleForceLogout}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: "#fee2e2",
            gap: 4,
          }}
        >
          <LogOut size={14} color="#ef4444" />
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#ef4444" }}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {isError && (
        <View style={{
          backgroundColor: "#fef2f2",
          borderColor: "#fecaca",
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}>
          <Text style={{ color: "#991b1b", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>
            ⚠️ Error Loading Dashboard
          </Text>
          <Text style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>
            {getErrorMessage(error)}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => refetch()}
              style={{
                backgroundColor: "#ef4444",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 12 }}>Tap to Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleForceLogout}
              style={{
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#fecaca",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: "#b91c1c", fontWeight: "600", fontSize: 12 }}>Re-login</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Room Status Cards */}
      <Text style={styles.sectionTitle}>Room Status</Text>
      {isLoading ? (
        <ActivityIndicator color="#2563eb" style={{ marginVertical: 20 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          {Object.entries(ROOM_STATUS_COLORS).map(([status, colors]) => (
            <View key={status} style={[styles.statusCard, { backgroundColor: colors.bg }]}>
              <Text style={[styles.statusCount, { color: colors.text }]}>
                {roomStatus[status] || 0}
              </Text>
              <Text style={[styles.statusLabel, { color: colors.text }]}>{colors.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Today's Activity */}
      <Text style={styles.sectionTitle}>Today</Text>
      <View style={styles.row}>
        <View style={[styles.metricCard, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.metricValue}>{stats?.todays_check_ins || 0}</Text>
          <Text style={styles.metricLabel}>Check-ins</Text>
        </View>
        <View style={[styles.metricCard, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.metricValue}>{stats?.todays_check_outs || 0}</Text>
          <Text style={styles.metricLabel}>Check-outs</Text>
        </View>
      </View>
      <View style={styles.revenueCard}>
        <TrendingUp size={20} color="#15803d" />
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.revenueLabel}>Today's Revenue</Text>
          <Text style={styles.revenueValue}>
            LKR {(stats?.todays_revenue || 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#2563eb" }]}
          onPress={() => router.push("/check-in")}
        >
          <Plus size={20} color="#fff" />
          <Text style={[styles.actionLabel, { color: "#fff" }]}>Check-in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#0f172a" }]}
          onPress={() => router.push("/checkout")}
        >
          <LogOut size={20} color="#fff" />
          <Text style={[styles.actionLabel, { color: "#fff" }]}>Checkout</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#b45309", opacity: 0.9 }]}
          onPress={() => router.push("/housekeeping")}
        >
          <Wrench size={20} color="#fff" />
          <Text style={[styles.actionLabel, { color: "#fff" }]}>Housekeeping</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#0f766e" }]}
          onPress={() => router.push("/(tabs)/guests")}
        >
          <Users size={20} color="#fff" />
          <Text style={[styles.actionLabel, { color: "#fff" }]}>Guests</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]}
          onPress={() => router.push("/new-guest" as any)}
        >
          <UserPlus size={20} color="#fff" />
          <Text style={[styles.actionLabel, { color: "#fff" }]}>New Guest</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { marginBottom: 20 },
  greetingText: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  dateText: { fontSize: 13, color: "#64748b", marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#334155", marginBottom: 10, marginTop: 16 },
  hScroll: { marginHorizontal: -4 },
  statusCard: {
    width: 90, borderRadius: 12, padding: 12, marginHorizontal: 4,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
  },
  statusCount: { fontSize: 24, fontWeight: "800" },
  statusLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  row: { flexDirection: "row" },
  metricCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  metricValue: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  metricLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  revenueCard: {
    backgroundColor: "#f0fdf4", borderRadius: 12, padding: 16, marginTop: 10,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  revenueLabel: { fontSize: 12, color: "#15803d" },
  revenueValue: { fontSize: 20, fontWeight: "800", color: "#14532d" },
  actionsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  actionBtn: {
    width: "48%", borderRadius: 12, padding: 14,
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  actionLabel: { fontSize: 13, fontWeight: "700" },
});
