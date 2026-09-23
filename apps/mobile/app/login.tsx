import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "expo-router";
import { Building2, Mail, Lock, Eye, EyeOff } from "lucide-react-native";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)/dashboard");
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Invalid credentials.";
      Alert.alert("Login Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Building2 size={40} color="#fff" />
          </View>
          <Text style={styles.title}>StayFlow</Text>
          <Text style={styles.subtitle}>Property Management System</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Mail size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              {showPassword ? (
                <EyeOff size={20} color="#94a3b8" />
              ) : (
                <Eye size={20} color="#94a3b8" />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>Demo Credentials</Text>
          <Text style={styles.demoText}>Owner: owner@stayflow.demo</Text>
          <Text style={styles.demoText}>Manager: manager@stayflow.demo</Text>
          <Text style={styles.demoText}>Password: Demo@12345!</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logoContainer: {
    width: 80, height: 80, backgroundColor: "#2563eb",
    borderRadius: 20, alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 16, color: "#94a3b8", marginTop: 4 },
  form: { gap: 16 },
  inputContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1e293b", borderRadius: 12,
    borderWidth: 1, borderColor: "#334155",
  },
  inputIcon: { padding: 16 },
  input: { flex: 1, height: 56, color: "#fff", fontSize: 16 },
  eyeIcon: { padding: 16 },
  loginBtn: {
    height: 56, backgroundColor: "#2563eb", borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  demoCard: {
    marginTop: 40, backgroundColor: "#1e293b", padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: "#334155",
  },
  demoTitle: { color: "#cbd5e1", fontSize: 14, fontWeight: "700", marginBottom: 8 },
  demoText: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
});
