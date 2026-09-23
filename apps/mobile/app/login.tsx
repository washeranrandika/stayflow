/**
 * StayFlow Mobile – Authentication Screen
 * Complete authentication with Sign In & Sign Up (Register new hotel/property)
 */
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, ScrollView, Image
} from "react-native";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "expo-router";
import {
  Mail, Lock, Eye, EyeOff, User, Building2, Phone,
  Sparkles, CheckCircle2, ArrowRight, ShieldCheck
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  // Mode: "SIGN_IN" or "SIGN_UP"
  const [mode, setMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_IN");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (error: any) {
      const msg = error.response?.data?.detail?.message || error.response?.data?.error?.message || "Invalid email or password.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!fullName.trim()) {
      Alert.alert("Required", "Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Required", "Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert("Password Requirements", "Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        hotel_name: hotelName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      Alert.alert(
        "🎉 Welcome to StayFlow",
        "Your hotel account has been successfully created!",
        [{ text: "Get Started", onPress: () => router.replace("/(tabs)/dashboard") }]
      );
    } catch (error: any) {
      const msg = error.response?.data?.detail?.message || error.response?.data?.error?.message || "Registration failed. Please try again.";
      Alert.alert("Sign Up Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const autoFillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Demo@12345!");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 24) + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Image
              source={require("../assets/icon.jpg")}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brandTitle}>StayFlow</Text>
          <Text style={styles.brandSubtitle}>Hotel & Property Management System</Text>
        </View>

        {/* Segmented Mode Switcher */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === "SIGN_IN" && styles.segmentBtnActive]}
            onPress={() => setMode("SIGN_IN")}
          >
            <Text style={[styles.segmentBtnText, mode === "SIGN_IN" && styles.segmentBtnTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === "SIGN_UP" && styles.segmentBtnActive]}
            onPress={() => setMode("SIGN_UP")}
          >
            <Text style={[styles.segmentBtnText, mode === "SIGN_UP" && styles.segmentBtnTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Container */}
        <View style={styles.formCard}>
          {mode === "SIGN_UP" && (
            <>
              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <View style={styles.inputContainer}>
                  <View style={styles.iconBox}>
                    <User size={18} color="#94a3b8" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Kasun Perera"
                    placeholderTextColor="#64748b"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              {/* Hotel / Property Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hotel / Property Name</Text>
                <View style={styles.inputContainer}>
                  <View style={styles.iconBox}>
                    <Building2 size={18} color="#94a3b8" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Grand Ocean Resort"
                    placeholderTextColor="#64748b"
                    value={hotelName}
                    onChangeText={setHotelName}
                  />
                </View>
              </View>

              {/* Phone Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Phone</Text>
                <View style={styles.inputContainer}>
                  <View style={styles.iconBox}>
                    <Phone size={18} color="#94a3b8" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. +94 77 123 4567"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>
            </>
          )}

          {/* Email Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Work Email Address *</Text>
            <View style={styles.inputContainer}>
              <View style={styles.iconBox}>
                <Mail size={18} color="#94a3b8" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="name@hotel.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password *</Text>
            <View style={styles.inputContainer}>
              <View style={styles.iconBox}>
                <Lock size={18} color="#94a3b8" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#64748b"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? (
                  <EyeOff size={18} color="#94a3b8" />
                ) : (
                  <Eye size={18} color="#94a3b8" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.actionBtn, isLoading && styles.actionBtnDisabled]}
            onPress={mode === "SIGN_IN" ? handleSignIn : handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.actionBtnText}>
                  {mode === "SIGN_IN" ? "Sign In to StayFlow" : "Create Hotel Account"}
                </Text>
                <ArrowRight size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Switch Prompt */}
          <View style={styles.switchPromptRow}>
            <Text style={styles.switchPromptText}>
              {mode === "SIGN_IN" ? "Don't have an account?" : "Already have an account?"}
            </Text>
            <TouchableOpacity onPress={() => setMode(mode === "SIGN_IN" ? "SIGN_UP" : "SIGN_IN")}>
              <Text style={styles.switchPromptLink}>
                {mode === "SIGN_IN" ? " Sign Up" : " Sign In"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Demo Quick Logins (Only shown on Sign In) */}
        {mode === "SIGN_IN" && (
          <View style={styles.demoBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Sparkles size={14} color="#38bdf8" />
              <Text style={styles.demoTitle}>Quick Demo Logins (1-Tap Fill)</Text>
            </View>

            <View style={styles.demoChipsRow}>
              <TouchableOpacity
                style={styles.demoChip}
                onPress={() => autoFillDemo("owner@stayflow.demo")}
              >
                <Text style={styles.demoChipRole}>👑 Owner</Text>
                <Text style={styles.demoChipEmail}>owner@stayflow.demo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoChip}
                onPress={() => autoFillDemo("manager@stayflow.demo")}
              >
                <Text style={styles.demoChipRole}>👔 Manager</Text>
                <Text style={styles.demoChipEmail}>manager@stayflow.demo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1329" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Header
  header: { alignItems: "center", marginBottom: 20 },
  logoBadge: {
    width: 64, height: 64, borderRadius: 16,
    borderWidth: 2, borderColor: "#334155", backgroundColor: "#1e293b",
    overflow: "hidden", marginBottom: 12,
  },
  logoImage: { width: "100%", height: "100%" },
  brandTitle: { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  brandSubtitle: { fontSize: 13, color: "#94a3b8", marginTop: 3 },

  // Segment Switcher
  segmentContainer: {
    flexDirection: "row", backgroundColor: "#1e293b", borderRadius: 12,
    padding: 4, marginBottom: 18, borderWidth: 1, borderColor: "#334155",
  },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center",
  },
  segmentBtnActive: { backgroundColor: "#2563eb" },
  segmentBtnText: { fontSize: 13, fontWeight: "700", color: "#94a3b8" },
  segmentBtnTextActive: { color: "#fff" },

  // Form Card
  formCard: {
    backgroundColor: "#111c38", borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: "#1e293b", gap: 14,
  },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#cbd5e1" },
  inputContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0b1329", borderRadius: 12,
    borderWidth: 1, borderColor: "#334155",
    height: 50,
    overflow: "hidden",
  },
  iconBox: {
    width: 44, height: 50,
    alignItems: "center", justifyContent: "center",
  },
  input: {
    flex: 1, height: 50, color: "#fff", fontSize: 14,
    paddingVertical: 0, paddingRight: 12,
  },
  eyeBtn: {
    width: 44, height: 50,
    alignItems: "center", justifyContent: "center",
  },

  actionBtn: {
    height: 50, backgroundColor: "#2563eb", borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 4,
    shadowColor: "#2563eb", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  switchPromptRow: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4,
  },
  switchPromptText: { fontSize: 13, color: "#94a3b8" },
  switchPromptLink: { fontSize: 13, fontWeight: "800", color: "#38bdf8" },

  // Demo Box
  demoBox: {
    marginTop: 18, backgroundColor: "#111c38", padding: 14,
    borderRadius: 14, borderWidth: 1, borderColor: "#1e293b",
  },
  demoTitle: { fontSize: 12, fontWeight: "800", color: "#38bdf8" },
  demoChipsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  demoChip: {
    flex: 1, backgroundColor: "#0b1329", padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#334155",
  },
  demoChipRole: { fontSize: 12, fontWeight: "800", color: "#f8fafc" },
  demoChipEmail: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
});
