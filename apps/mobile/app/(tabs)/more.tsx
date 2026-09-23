import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from "react-native";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Building2, LogOut, FileText, User, Settings as SettingsIcon,
  ChevronRight, ShieldCheck, Sparkles, Sliders
} from "lucide-react-native";

export default function MoreScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Are you sure you want to sign out?")) {
        await logout();
        router.replace("/login");
      }
      return;
    }
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of StayFlow?",
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={[styles.profileSection]}
        onPress={() => router.push("/profile" as any)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.full_name || "U").slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.name}>{user?.full_name || "Staff Member"}</Text>
            <View style={styles.verifiedTag}>
              <ShieldCheck size={11} color="#15803d" />
            </View>
          </View>
          <Text style={styles.email}>{user?.email || "user@stayflow.com"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role || "STAFF"}</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#94a3b8" />
      </TouchableOpacity>

      {/* Operations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operations</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/checkout")}>
            <View style={[styles.iconBox, { backgroundColor: "#eff6ff" }]}>
              <LogOut size={18} color="#2563eb" />
            </View>
            <Text style={styles.cardText}>Active Stays & Checkout</Text>
            <ChevronRight size={16} color="#cbd5e1" style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/housekeeping")}>
            <View style={[styles.iconBox, { backgroundColor: "#f0fdf4" }]}>
              <Building2 size={18} color="#16a34a" />
            </View>
            <Text style={styles.cardText}>Housekeeping & Cleaning</Text>
            <ChevronRight size={16} color="#cbd5e1" style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/reports")}>
            <View style={[styles.iconBox, { backgroundColor: "#faf5ff" }]}>
              <FileText size={18} color="#9333ea" />
            </View>
            <Text style={styles.cardText}>Manager Reports & KPIs</Text>
            <ChevronRight size={16} color="#cbd5e1" style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings / Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account & App</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/profile" as any)}>
            <View style={[styles.iconBox, { backgroundColor: "#eff6ff" }]}>
              <User size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardText}>Profile Settings</Text>
              <Text style={styles.cardSubText}>Name, phone, password & preferences</Text>
            </View>
            <ChevronRight size={16} color="#cbd5e1" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/profile" as any)}>
            <View style={[styles.iconBox, { backgroundColor: "#f8fafc" }]}>
              <Sliders size={18} color="#475569" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardText}>App Preferences</Text>
              <Text style={styles.cardSubText}>Live sync, alerts & security</Text>
            </View>
            <ChevronRight size={16} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Organization Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hotel Property</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.iconBox, { backgroundColor: "#f1f5f9" }]}>
              <Building2 size={18} color="#64748b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardText}>{user?.organization_name || "StayFlow Property Cloud"}</Text>
              <Text style={styles.cardSubText}>Multi-Tenant Organization</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
      
      <Text style={styles.version}>StayFlow PMS • Version 1.0.0</Text>
      <View style={{ height: 30 }} />
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
  cardText: { fontSize: 15, color: "#0f172a", fontWeight: "700" },
  cardSubText: { fontSize: 11, color: "#64748b", marginTop: 2 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedTag: {
    backgroundColor: "#f0fdf4",
    padding: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginLeft: 64 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    margin: 20, padding: 16, backgroundColor: "#fef2f2",
    borderRadius: 12, borderWidth: 1, borderColor: "#fecaca", gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "800", color: "#ef4444" },
  version: { textAlign: "center", color: "#94a3b8", fontSize: 12, fontWeight: "600" },
});
