import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ClipboardList, CheckCircle2, PlayCircle, Clock } from "lucide-react-native";

export default function MobileHousekeepingScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["mobileHousekeeping", filter],
    queryFn: () => apiClient.get("/housekeeping/tasks", {
      params: filter !== "ALL" ? { status: filter } : {},
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/housekeeping/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobileHousekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.error?.message || "Failed to update task");
    },
  });

  const tasks = data?.data?.data || [];

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"].map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.tab, filter === st && styles.tabActive]}
            onPress={() => setFilter(st)}
          >
            <Text style={[styles.tabText, filter === st && styles.tabTextActive]}>
              {st === "ALL" ? "All" : st.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
        ) : tasks.length === 0 ? (
          <View style={styles.empty}>
            <ClipboardList size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No cleaning tasks for selected filter.</Text>
          </View>
        ) : (
          tasks.map((task: any) => (
            <View key={task.id} style={styles.card}>
              <View style={styles.header}>
                <View style={styles.roomTag}>
                  <Text style={styles.roomText}>Room {task.room?.room_number || "—"}</Text>
                </View>
                <View style={[
                  styles.statusTag,
                  task.status === "COMPLETED" ? styles.tagGreen :
                  task.status === "IN_PROGRESS" ? styles.tagBlue : styles.tagAmber
                ]}>
                  <Text style={[
                    styles.statusTagText,
                    task.status === "COMPLETED" ? styles.textGreen :
                    task.status === "IN_PROGRESS" ? styles.textBlue : styles.textAmber
                  ]}>
                    {task.status.replace("_", " ")}
                  </Text>
                </View>
              </View>

              <Text style={styles.notes}>{task.notes || "Post-checkout cleaning"}</Text>
              <Text style={styles.time}>
                Created: {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>

              {/* Actions */}
              <View style={styles.actions}>
                {task.status === "PENDING" && (
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => updateMutation.mutate({ id: task.id, status: "IN_PROGRESS" })}
                  >
                    <PlayCircle size={16} color="#1d4ed8" />
                    <Text style={styles.startBtnText}>Start Cleaning</Text>
                  </TouchableOpacity>
                )}
                {task.status === "IN_PROGRESS" && (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => updateMutation.mutate({ id: task.id, status: "COMPLETED" })}
                  >
                    <CheckCircle2 size={16} color="#fff" />
                    <Text style={styles.completeBtnText}>Mark Ready (Available)</Text>
                  </TouchableOpacity>
                )}
                {task.status === "COMPLETED" && (
                  <View style={styles.completedTag}>
                    <CheckCircle2 size={14} color="#15803d" />
                    <Text style={styles.completedTagText}>Room Available</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  tabBar: { flexDirection: "row", padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#f1f5f9" },
  tabActive: { backgroundColor: "#2563eb" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  tabTextActive: { color: "#fff" },
  scroll: { padding: 16 },
  empty: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { color: "#64748b", marginTop: 8, fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roomTag: { backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roomText: { color: "#1d4ed8", fontWeight: "700", fontSize: 13 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusTagText: { fontSize: 11, fontWeight: "700" },
  tagGreen: { backgroundColor: "#dcfce7" },
  textGreen: { color: "#15803d" },
  tagBlue: { backgroundColor: "#dbeafe" },
  textBlue: { color: "#1d4ed8" },
  tagAmber: { backgroundColor: "#fef3c7" },
  textAmber: { color: "#b45309" },
  notes: { fontSize: 14, color: "#334155", marginTop: 8 },
  time: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  actions: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, backgroundColor: "#eff6ff", borderRadius: 8 },
  startBtnText: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, backgroundColor: "#16a34a", borderRadius: 8 },
  completeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  completedTag: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  completedTagText: { color: "#15803d", fontSize: 12, fontWeight: "600" },
});
