/**
 * StayFlow Mobile – Profile & Account Settings Screen
 * Edit personal profile (Name, Phone), change password with live validation,
 * manage PMS app preferences (Notifications, Live sync, Currency), and view organization details.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  User,
  Phone,
  Mail,
  Lock,
  Building2,
  Bell,
  ShieldCheck,
  ChevronLeft,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Sliders,
  LogOut,
  Save,
  Globe,
} from "lucide-react-native";

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, setUser, logout } = useAuthStore();

  // Profile Form state
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // App Preferences state
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  // Fetch fresh profile data
  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: () => api.get("/users/me"),
  });

  useEffect(() => {
    if (profileData?.data?.data) {
      const u = profileData.data.data;
      setFullName(u.full_name || "");
      setPhone(u.phone || "");
    }
  }, [profileData]);

  // Mutation: Update Profile Details
  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name: string; phone: string }) =>
      api.patch("/users/me", data),
    onSuccess: (res: any) => {
      const updatedUser = res.data?.data;
      if (updatedUser) {
        setUser({ ...user, ...updatedUser });
      }
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      Alert.alert("✅ Profile Updated", "Your profile details have been saved.");
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail?.message ||
        err.response?.data?.detail ||
        "Failed to update profile";
      Alert.alert("Update Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  // Mutation: Change Password
  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => api.post("/users/me/change-password", data),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
      Alert.alert("🔒 Password Changed", "Your password has been updated securely.");
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail?.message ||
        err.response?.data?.detail ||
        "Failed to change password";
      Alert.alert("Error", typeof msg === "string" ? msg : "Current password may be incorrect.");
    },
  });

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      Alert.alert("Validation", "Full name cannot be blank.");
      return;
    }
    updateProfileMutation.mutate({
      full_name: fullName.trim(),
      phone: phone.trim(),
    });
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      Alert.alert("Required", "Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Weak Password", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }
    changePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 12 : 8) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Profile & Settings</Text>
          <Text style={styles.headerSub}>Account info & PMS preferences</Text>
        </View>
        <TouchableOpacity
          onPress={handleSaveProfile}
          disabled={updateProfileMutation.isPending}
          style={[styles.saveHeaderBtn, updateProfileMutation.isPending && { opacity: 0.5 }]}
        >
          {updateProfileMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveHeaderBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. User Avatar Hero Section ────────────────────────────── */}
        <View style={styles.userHeroCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {(fullName || user?.full_name || "U").slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.heroName}>{fullName || user?.full_name || "User"}</Text>
              <View style={styles.verifiedPill}>
                <ShieldCheck size={12} color="#15803d" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
            <Text style={styles.heroEmail}>{user?.email || "user@hotel.com"}</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{user?.role || "STAFF"}</Text>
            </View>
          </View>
        </View>

        {/* ── 2. Personal Profile Information ─────────────────────────── */}
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputBox}>
              <User size={16} color="#94a3b8" />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputBox}>
              <Phone size={16} color="#94a3b8" />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+94 77 123 4567"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email Address (Login ID)</Text>
            <View style={[styles.inputBox, styles.inputDisabled]}>
              <Mail size={16} color="#94a3b8" />
              <TextInput
                style={[styles.input, { color: "#64748b" }]}
                value={user?.email || ""}
                editable={false}
              />
              <CheckCircle2 size={16} color="#16a34a" />
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Save size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Update Profile Information</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── 3. Security & Password Management ───────────────────────── */}
        <Text style={styles.sectionTitle}>Security & Credentials</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.togglePasswordRow}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
          >
            <View style={styles.iconCircle}>
              <KeyRound size={16} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRowTitle}>Change Account Password</Text>
              <Text style={styles.cardRowSub}>Update your login credentials securely</Text>
            </View>
            <Text style={styles.toggleActionText}>
              {showPasswordSection ? "Cancel" : "Change"}
            </Text>
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.passwordForm}>
              <View style={styles.field}>
                <Text style={styles.label}>Current Password</Text>
                <View style={styles.inputBox}>
                  <Lock size={16} color="#94a3b8" />
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>New Password (Min 8 characters)</Text>
                <View style={styles.inputBox}>
                  <Lock size={16} color="#94a3b8" />
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.inputBox}>
                  <Lock size={16} color="#94a3b8" />
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.changePasswordBtn}
                onPress={handleChangePassword}
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.changePasswordBtnText}>Save New Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 4. App Preferences & Live Sync ─────────────────────────── */}
        <Text style={styles.sectionTitle}>App Preferences & Sync</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.iconCircle}>
              <Sparkles size={16} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRowTitle}>Live Background Sync</Text>
              <Text style={styles.cardRowSub}>Automatic 60s room and booking refresh</Text>
            </View>
            <Switch
              value={liveSyncEnabled}
              onValueChange={setLiveSyncEnabled}
              trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
              thumbColor={liveSyncEnabled ? "#2563eb" : "#f1f5f9"}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.iconCircle}>
              <Bell size={16} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRowTitle}>Push Notifications</Text>
              <Text style={styles.cardRowSub}>Check-in & housekeeping alert badges</Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
              thumbColor={pushNotifications ? "#2563eb" : "#f1f5f9"}
            />
          </View>
        </View>

        {/* ── 5. Organization & Property Info ─────────────────────────── */}
        <Text style={styles.sectionTitle}>Hotel & Property</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Building2 size={16} color="#0f172a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Organization Name</Text>
              <Text style={styles.infoValue}>
                {user?.organization_name || "StayFlow Property Cloud"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Globe size={16} color="#0f172a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Currency & Standard</Text>
              <Text style={styles.infoValue}>LKR (Sri Lankan Rupee - Rs.) • 24h Time</Text>
            </View>
          </View>
        </View>

        {/* ── 6. Sign Out Button ──────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#dc2626" />
          <Text style={styles.logoutBtnText}>Sign Out of StayFlow</Text>
        </TouchableOpacity>

        <Text style={styles.footerVersion}>StayFlow PMS v1.0.0 • Multi-Tenant Protected</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a", letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  saveHeaderBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveHeaderBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 2,
  },

  // User Hero Card
  userHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#eff6ff",
    borderWidth: 2,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: { fontSize: 22, fontWeight: "900", color: "#1d4ed8" },
  heroName: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  heroEmail: { fontSize: 12, color: "#64748b", marginTop: 2 },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  verifiedText: { fontSize: 9, fontWeight: "800", color: "#15803d" },
  roleChip: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  roleChipText: { fontSize: 10, fontWeight: "800", color: "#475569" },

  // Card & Inputs
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", color: "#334155", marginBottom: 5 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputDisabled: { backgroundColor: "#f8fafc", borderColor: "#f1f5f9" },
  input: { flex: 1, fontSize: 14, color: "#0f172a" },

  saveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Password section
  togglePasswordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  cardRowTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  cardRowSub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  toggleActionText: { fontSize: 13, fontWeight: "700", color: "#2563eb" },
  passwordForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  changePasswordBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 6,
  },
  changePasswordBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Switches
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 8 },

  // Organization Info
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  infoValue: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginTop: 2 },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#fecaca",
    marginTop: 20,
  },
  logoutBtnText: { color: "#dc2626", fontSize: 15, fontWeight: "800" },
  footerVersion: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 16,
    fontWeight: "500",
  },
});
