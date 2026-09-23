import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "expo-router";
import { Building2, LogOut, FileText, User, Settings as SettingsIcon } from "lucide-react-native";

export default function MoreScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          }
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.charAt(0) || "U"}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{user?.full_name || "User"}</Text>
          <Text style={styles.email}>{user?.email || "user@stayflow.demo"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role || "STAFF"}</Text>
          </View>
        </View>
      </View>

      {/* Operations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operations</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/checkout")}>
            <LogOut size={20} color="#2563eb" />
            <Text style={styles.cardText}>Active Stays & Checkout</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/housekeeping")}>
            <Building2 size={20} color="#16a34a" />
            <Text style={styles.cardText}>Housekeeping & Cleaning</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/reports")}>
            <FileText size={20} color="#9333ea" />
            <Text style={styles.cardText}>Manager Reports & KPIs</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Organization Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organization</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Building2 size={20} color="#64748b" />
            <Text style={styles.cardText}>{user?.organization_name || "StayFlow Demo"}</Text>
          </View>
        </View>
      </View>

      {/* Settings / Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardRow}>
            <User size={20} color="#64748b" />
            <Text style={styles.cardText}>Profile Settings</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.cardRow}>
            <FileText size={20} color="#64748b" />
            <Text style={styles.cardText}>Terms & Privacy</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.cardRow}>
            <SettingsIcon size={20} color="#64748b" />
            <Text style={styles.cardText}>App Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
      
      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  profileSection: {
    flexDirection: "row", alignItems: "center", padding: 20,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#e0e7ff",
    alignItems: "center", justifyContent: "center", marginRight: 16,
  },
  avatarText: { fontSize: 24, fontWeight: "700", color: "#4338ca" },
  profileInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 2 },
  email: { fontSize: 14, color: "#64748b", marginBottom: 6 },
  roleBadge: {
    backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, alignSelf: "flex-start",
  },
  roleText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  section: { padding: 20, paddingBottom: 0 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row", alignItems: "center", padding: 16, gap: 12,
  },
  cardText: { fontSize: 16, color: "#0f172a", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginLeft: 48 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    margin: 20, padding: 16, backgroundColor: "#fef2f2",
    borderRadius: 12, borderWidth: 1, borderColor: "#fecaca", gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: "700", color: "#ef4444" },
  version: { textAlign: "center", color: "#94a3b8", fontSize: 13, marginBottom: 40 },
});
