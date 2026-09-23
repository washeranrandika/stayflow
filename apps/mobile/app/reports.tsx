import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { BarChart3, TrendingUp, DollarSign, BedDouble } from "lucide-react-native";

export default function MobileReportsScreen() {
  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ["mobileRevReport"],
    queryFn: () => apiClient.get("/reports/revenue"),
  });

  const { data: occData, isLoading: occLoading } = useQuery({
    queryKey: ["mobileOccReport"],
    queryFn: () => apiClient.get("/reports/occupancy"),
  });

  const rev = revData?.data?.data || {};
  const occ = occData?.data?.data || {};

  if (revLoading || occLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manager Quick Reports</Text>
        <Text style={styles.subtitle}>Daily performance and room occupancy indicators.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <DollarSign size={20} color="#16a34a" />
          <Text style={styles.cardTitle}>Revenue Summary</Text>
        </View>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Today</Text>
            <Text style={styles.kpiValue}>Rs. {Number(rev.today_revenue || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>This Month</Text>
            <Text style={[styles.kpiValue, { color: "#2563eb" }]}>
              Rs. {Number(rev.month_revenue || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <BedDouble size={20} color="#2563eb" />
          <Text style={styles.cardTitle}>Occupancy Overview</Text>
        </View>
        <View style={styles.occRow}>
          <View style={styles.circleBadge}>
            <Text style={styles.circleText}>{occ.occupancy_rate || 0}%</Text>
          </View>
          <View style={styles.occDetails}>
            <Text style={styles.occLine}>
              <Text style={styles.bold}>{occ.occupied_rooms || 0}</Text> rooms currently occupied
            </Text>
            <Text style={styles.occLine}>
              <Text style={styles.bold}>{occ.available_rooms || 0}</Text> rooms available
            </Text>
            <Text style={styles.occLine}>
              <Text style={styles.bold}>{occ.total_rooms || 0}</Text> total inventory
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  card: { margin: 16, marginBottom: 0, backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiBox: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 8, padding: 12 },
  kpiLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase" },
  kpiValue: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  occRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  circleBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#2563eb" },
  circleText: { fontSize: 16, fontWeight: "800", color: "#1d4ed8" },
  occDetails: { flex: 1, gap: 4 },
  occLine: { fontSize: 13, color: "#475569" },
  bold: { fontWeight: "700", color: "#0f172a" },
});
