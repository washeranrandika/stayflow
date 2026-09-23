/**
 * StayFlow Mobile – Manager Quick Analytics & Reports Screen
 * Features real-time KPI metrics, ADR, RevPAR, live inventory breakdown,
 * payment channel distribution, and recent financial transactions.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DollarSign,
  BedDouble,
  TrendingUp,
  CreditCard,
  ChevronLeft,
  Calendar,
  RefreshCw,
  Sparkles,
  PieChart,
  ArrowUpRight,
  ShieldCheck,
  Receipt,
  User,
  Layers,
} from "lucide-react-native";

const PERIODS = [
  { key: "TODAY", label: "Today", days: 0 },
  { key: "7D", label: "7 Days", days: 7 },
  { key: "30D", label: "30 Days", days: 30 },
  { key: "MONTH", label: "This Month", days: 30 },
];

function getPeriodDates(periodKey: string): {
  from_date: string;
  to_date: string;
} {
  const today = new Date();
  const to_date = today.toISOString().split("T")[0];

  if (periodKey === "TODAY") {
    return { from_date: to_date, to_date };
  }
  if (periodKey === "7D") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return { from_date: d.toISOString().split("T")[0], to_date };
  }
  if (periodKey === "MONTH") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from_date: firstDay.toISOString().split("T")[0], to_date };
  }
  // 30D default
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return { from_date: d.toISOString().split("T")[0], to_date };
}

export default function MobileReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPeriod, setSelectedPeriod] = useState("30D");

  const { from_date, to_date } = getPeriodDates(selectedPeriod);

  // 1. Revenue & KPIs
  const {
    data: revData,
    isLoading: revLoading,
    refetch: refetchRev,
    isRefetching: revRefetching,
  } = useQuery({
    queryKey: ["revenueReport", from_date, to_date],
    queryFn: () =>
      api.get("/reports/revenue", { params: { from_date, to_date } }),
  });

  // 2. Live Occupancy Breakdown
  const {
    data: occData,
    isLoading: occLoading,
    refetch: refetchOcc,
    isRefetching: occRefetching,
  } = useQuery({
    queryKey: ["occupancyReport", from_date, to_date],
    queryFn: () =>
      api.get("/reports/occupancy", { params: { from_date, to_date } }),
  });

  // 3. Payments breakdown
  const {
    data: payData,
    isLoading: payLoading,
    refetch: refetchPay,
    isRefetching: payRefetching,
  } = useQuery({
    queryKey: ["paymentReport", from_date, to_date],
    queryFn: () =>
      api.get("/reports/payments", { params: { from_date, to_date } }),
  });

  const isRefreshing = revRefetching || occRefetching || payRefetching;
  const isLoading = revLoading || occLoading || payLoading;

  const onRefreshAll = () => {
    refetchRev();
    refetchOcc();
    refetchPay();
  };

  const rev = revData?.data?.data || {};
  const occ = occData?.data?.data || {};
  const pay = payData?.data?.data || {};

  const totalRev = Number(rev.total_revenue || 0);
  const roomRev = Number(rev.room_revenue || 0);
  const serviceRev = Number(rev.service_revenue || 0);
  const todayRev = Number(rev.today_revenue || 0);
  const monthRev = Number(rev.month_revenue || 0);
  const adr = Number(rev.adr || 0);
  const revpar = Number(rev.revpar || 0);

  const occRate = Number(occ.occupancy_rate || 0);
  const totalRooms = Number(occ.total_rooms || 0);
  const occupiedRooms = Number(occ.occupied_rooms || 0);
  const availableRooms = Number(occ.available_rooms || 0);
  const cleaningRooms = Number(occ.cleaning_rooms || 0);
  const maintenanceRooms = Number(occ.maintenance_rooms || 0);
  const reservedRooms = Number(occ.reserved_rooms || 0);

  const paymentsByMethod: Record<string, number> = rev.payments_by_method || {};
  const recentTx: any[] = rev.recent_transactions || [];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Manager Analytics</Text>
          <Text style={styles.headerSub}>Live Revenue, Occupancy & KPIs</Text>
        </View>
        <TouchableOpacity onPress={onRefreshAll} style={styles.refreshBtn}>
          <RefreshCw size={18} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Period Filter Bar */}
      <View style={styles.periodBarContainer}>
        <View style={styles.periodBar}>
          {PERIODS.map((p) => {
            const isActive = selectedPeriod === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodChip, isActive && styles.periodChipActive]}
                onPress={() => setSelectedPeriod(p.key)}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    isActive && styles.periodChipTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoading && !isRefreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>
            Calculating real-time analytics...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefreshAll}
            />
          }
        >
          {/* ── 1. Top Executive Revenue Hero Card ──────────────────────── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>
                  Total Revenue ({selectedPeriod})
                </Text>
                <Text style={styles.heroValue}>
                  Rs. {totalRev.toLocaleString()}
                </Text>
              </View>
              <View style={styles.heroIconCircle}>
                <DollarSign size={24} color="#16a34a" />
              </View>
            </View>

            {/* Sub KPI comparisons */}
            <View style={styles.heroDivider} />
            <View style={styles.heroSubRow}>
              <View style={styles.heroSubItem}>
                <Text style={styles.heroSubLabel}>Today's Revenue</Text>
                <Text style={styles.heroSubValue}>
                  Rs. {todayRev.toLocaleString()}
                </Text>
              </View>
              <View style={styles.heroSubItemDivider} />
              <View style={styles.heroSubItem}>
                <Text style={styles.heroSubLabel}>Month to Date</Text>
                <Text style={[styles.heroSubValue, { color: "#60a5fa" }]}>
                  Rs. {monthRev.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* ── 2. Hospitality Core Metrics (ADR, RevPAR, Occupancy) ────── */}
          <Text style={styles.sectionTitle}>Hospitality Performance Index</Text>
          <View style={styles.kpiGrid}>
            {/* Occupancy Rate */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiIconBoxBlue}>
                <BedDouble size={18} color="#2563eb" />
              </View>
              <Text style={styles.kpiCardLabel}>Live Occupancy</Text>
              <Text style={styles.kpiCardValue}>{occRate}%</Text>
              <Text style={styles.kpiCardSub}>
                {occupiedRooms} / {totalRooms} rooms active
              </Text>
            </View>

            {/* ADR */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiIconBoxGreen}>
                <TrendingUp size={18} color="#15803d" />
              </View>
              <Text style={styles.kpiCardLabel}>ADR (Avg Rate)</Text>
              <Text style={styles.kpiCardValue}>
                Rs. {adr > 0 ? Math.round(adr).toLocaleString() : "—"}
              </Text>
              <Text style={styles.kpiCardSub}>Per occupied room</Text>
            </View>

            {/* RevPAR */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiIconBoxPurple}>
                <Sparkles size={18} color="#7c3aed" />
              </View>
              <Text style={styles.kpiCardLabel}>RevPAR</Text>
              <Text style={styles.kpiCardValue}>
                Rs. {revpar > 0 ? Math.round(revpar).toLocaleString() : "—"}
              </Text>
              <Text style={styles.kpiCardSub}>Per available room</Text>
            </View>
          </View>

          {/* ── 3. Live Room Inventory Breakdown ───────────────────────── */}
          <Text style={styles.sectionTitle}>Room Inventory Status</Text>
          <View style={styles.inventoryCard}>
            <View style={styles.inventoryProgressTrack}>
              {totalRooms > 0 && (
                <>
                  <View
                    style={[
                      styles.invBarOccupied,
                      { width: `${(occupiedRooms / totalRooms) * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.invBarAvailable,
                      { width: `${(availableRooms / totalRooms) * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.invBarCleaning,
                      { width: `${(cleaningRooms / totalRooms) * 100}%` },
                    ]}
                  />
                </>
              )}
            </View>

            <View style={styles.inventoryBadgesGrid}>
              <View
                style={[
                  styles.invBadge,
                  { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
                ]}
              >
                <Text style={[styles.invBadgeCount, { color: "#b91c1c" }]}>
                  {occupiedRooms}
                </Text>
                <Text style={styles.invBadgeLabel}>Occupied</Text>
              </View>

              <View
                style={[
                  styles.invBadge,
                  { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
                ]}
              >
                <Text style={[styles.invBadgeCount, { color: "#15803d" }]}>
                  {availableRooms}
                </Text>
                <Text style={styles.invBadgeLabel}>Available</Text>
              </View>

              <View
                style={[
                  styles.invBadge,
                  { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
                ]}
              >
                <Text style={[styles.invBadgeCount, { color: "#1d4ed8" }]}>
                  {reservedRooms}
                </Text>
                <Text style={styles.invBadgeLabel}>Reserved</Text>
              </View>

              <View
                style={[
                  styles.invBadge,
                  { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
                ]}
              >
                <Text style={[styles.invBadgeCount, { color: "#b45309" }]}>
                  {cleaningRooms}
                </Text>
                <Text style={styles.invBadgeLabel}>Cleaning</Text>
              </View>

              <View
                style={[
                  styles.invBadge,
                  { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
                ]}
              >
                <Text style={[styles.invBadgeCount, { color: "#c2410c" }]}>
                  {maintenanceRooms}
                </Text>
                <Text style={styles.invBadgeLabel}>Maintenance</Text>
              </View>
            </View>
          </View>

          {/* ── 4. Revenue Channels & Sources ──────────────────────────── */}
          <Text style={styles.sectionTitle}>Revenue Streams</Text>
          <View style={styles.card}>
            <View style={styles.streamRow}>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <BedDouble size={16} color="#2563eb" />
                  <Text style={styles.streamTitle}>Room Stay Charges</Text>
                </View>
                <Text style={styles.streamSub}>
                  Direct bookings & reservations
                </Text>
              </View>
              <Text style={styles.streamValue}>
                Rs. {roomRev.toLocaleString()}
              </Text>
            </View>

            <View style={styles.streamDivider} />

            <View style={styles.streamRow}>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Sparkles size={16} color="#16a34a" />
                  <Text style={styles.streamTitle}>Services & Add-ons</Text>
                </View>
                <Text style={styles.streamSub}>
                  Dining, mini-bar, laundry & extras
                </Text>
              </View>
              <Text style={styles.streamValue}>
                Rs. {serviceRev.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* ── 5. Payment Methods ─────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Payment Channels</Text>
          <View style={styles.card}>
            {Object.keys(paymentsByMethod).length === 0 ? (
              <View style={{ padding: 12, alignItems: "center" }}>
                <CreditCard size={24} color="#94a3b8" />
                <Text style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  No payment collections recorded in this period.
                </Text>
              </View>
            ) : (
              Object.entries(paymentsByMethod).map(([method, amt], idx) => (
                <View key={method}>
                  {idx > 0 && <View style={styles.streamDivider} />}
                  <View style={styles.pmRow}>
                    <View style={styles.pmIconCircle}>
                      <CreditCard size={15} color="#2563eb" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pmMethodName}>
                        {method.replace(/_/g, " ")}
                      </Text>
                      <Text style={styles.pmMethodSub}>
                        {totalRev > 0
                          ? `${Math.round((amt / totalRev) * 100)}% of revenue`
                          : ""}
                      </Text>
                    </View>
                    <Text style={styles.pmAmount}>
                      Rs. {Number(amt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── 6. Recent Transactions Feed ────────────────────────────── */}
          <Text style={styles.sectionTitle}>Latest Collected Transactions</Text>
          <View style={styles.card}>
            {recentTx.length === 0 ? (
              <View style={{ padding: 16, alignItems: "center" }}>
                <Receipt size={24} color="#94a3b8" />
                <Text style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  No recent transaction records available.
                </Text>
              </View>
            ) : (
              recentTx.slice(0, 6).map((tx, idx) => (
                <View key={tx.id || idx}>
                  {idx > 0 && <View style={styles.streamDivider} />}
                  <View style={styles.txRow}>
                    <View style={styles.txIconCircle}>
                      <User size={14} color="#0f172a" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txGuestName}>
                        {tx.guest_name || "Guest"}
                      </Text>
                      <Text style={styles.txMeta}>
                        Room {tx.room_number || "—"} •{" "}
                        {tx.payment_method?.replace(/_/g, " ")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.txAmount}>
                        +Rs. {Number(tx.amount).toLocaleString()}
                      </Text>
                      <Text style={styles.txTime}>
                        {new Date(tx.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSub: { fontSize: 11, color: "#64748b", marginTop: 1 },

  // Period Selector Bar
  periodBarContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  periodBar: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  periodChipActive: {
    backgroundColor: "#2563eb",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  periodChipText: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  periodChipTextActive: { color: "#ffffff" },

  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },

  // Hero Card
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  heroValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  heroDivider: { height: 1, backgroundColor: "#1e293b", marginVertical: 14 },
  heroSubRow: { flexDirection: "row", alignItems: "center" },
  heroSubItem: { flex: 1 },
  heroSubItemDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#334155",
    marginHorizontal: 12,
  },
  heroSubLabel: { fontSize: 11, color: "#94a3b8" },
  heroSubValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#34d399",
    marginTop: 2,
  },

  // KPI Grid
  kpiGrid: { flexDirection: "row", gap: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiIconBoxBlue: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  kpiIconBoxGreen: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  kpiIconBoxPurple: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  kpiCardLabel: { fontSize: 10, fontWeight: "700", color: "#64748b" },
  kpiCardValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginVertical: 2,
  },
  kpiCardSub: { fontSize: 9, color: "#94a3b8" },

  // Inventory Card
  inventoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inventoryProgressTrack: {
    flexDirection: "row",
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  invBarOccupied: { backgroundColor: "#ef4444", height: "100%" },
  invBarAvailable: { backgroundColor: "#22c55e", height: "100%" },
  invBarCleaning: { backgroundColor: "#f59e0b", height: "100%" },

  inventoryBadgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  invBadge: {
    flex: 1,
    minWidth: "18%",
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  invBadgeCount: { fontSize: 14, fontWeight: "900" },
  invBadgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 2,
  },

  // General Card
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  streamRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  streamTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  streamSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  streamValue: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  streamDivider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },

  // Payment Methods
  pmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  pmIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  pmMethodName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  pmMethodSub: { fontSize: 11, color: "#64748b" },
  pmAmount: { fontSize: 13, fontWeight: "900", color: "#0f172a" },

  // Transactions Feed
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  txIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  txGuestName: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  txMeta: { fontSize: 11, color: "#64748b", marginTop: 1 },
  txAmount: { fontSize: 13, fontWeight: "900", color: "#16a34a" },
  txTime: { fontSize: 10, color: "#94a3b8", marginTop: 1 },
});
