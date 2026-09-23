/**
 * StayFlow Mobile – New Guest / Walk-in Registration Screen
 * Creates a guest profile; optionally proceeds to check-in.
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { User, Phone, Mail, CreditCard, MapPin, ChevronLeft } from "lucide-react-native";

interface GuestForm {
  full_name: string;
  phone: string;
  email: string;
  id_type: string;
  id_number: string;
  nationality: string;
  address: string;
}

const ID_TYPES = ["NATIONAL_ID", "PASSPORT", "DRIVING_LICENSE", "OTHER"];

export default function NewGuestScreen() {
  const router = useRouter();
  const [form, setForm] = useState<GuestForm>({
    full_name: "",
    phone: "",
    email: "",
    id_type: "NATIONAL_ID",
    id_number: "",
    nationality: "",
    address: "",
  });

  const set = (key: keyof GuestForm) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/guests", data),
    onSuccess: (res: any) => {
      const guest = res.data?.data;
      Alert.alert(
        "✅ Guest Created",
        `${guest?.full_name} has been registered.`,
        [
          { text: "Go Back", onPress: () => router.back() },
          {
            text: "Proceed to Check-in",
            onPress: () => {
              router.replace("/check-in");
            },
          },
        ]
      );
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail
        ?? err.response?.data?.error?.message
        ?? "Failed to create guest. Please check the form.";
      Alert.alert("Error", msg);
    },
  });

  const handleSubmit = () => {
    if (!form.full_name.trim()) {
      Alert.alert("Validation", "Guest full name is required.");
      return;
    }
    const payload: any = { full_name: form.full_name.trim() };
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.id_type) payload.id_type = form.id_type;
    if (form.id_number.trim()) payload.id_number = form.id_number.trim();
    if (form.nationality.trim()) payload.nationality = form.nationality.trim();
    if (form.address.trim()) payload.address = form.address.trim();
    createMutation.mutate(payload);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Guest</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Personal Info */}
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name *</Text>
          <View style={styles.inputBox}>
            <User size={16} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="e.g. John Perera"
              value={form.full_name}
              onChangeText={set("full_name")}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <View style={styles.inputBox}>
            <Phone size={16} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="+94 71 234 5678"
              value={form.phone}
              onChangeText={set("phone")}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputBox}>
            <Mail size={16} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="guest@email.com"
              value={form.email}
              onChangeText={set("email")}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Identity */}
        <Text style={styles.sectionTitle}>Identity Document</Text>

        <View style={styles.field}>
          <Text style={styles.label}>ID Type</Text>
          <View style={styles.typeRow}>
            {ID_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, form.id_type === t && styles.typeBtnActive]}
                onPress={() => set("id_type")(t)}
              >
                <Text style={[styles.typeBtnText, form.id_type === t && styles.typeBtnTextActive]}>
                  {t.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ID Number</Text>
          <View style={styles.inputBox}>
            <CreditCard size={16} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="ID / Passport number"
              value={form.id_number}
              onChangeText={set("id_number")}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nationality</Text>
          <TextInput
            style={[styles.inputBox, { paddingHorizontal: 14 }]}
            placeholder="e.g. Sri Lankan"
            value={form.nationality}
            onChangeText={set("nationality")}
            autoCapitalize="words"
          />
        </View>

        {/* Address */}
        <Text style={styles.sectionTitle}>Address</Text>
        <View style={styles.field}>
          <View style={[styles.inputBox, styles.multilineBox]}>
            <MapPin size={16} color="#94a3b8" style={{ marginTop: 2 }} />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Street, city, country"
              value={form.address}
              onChangeText={set("address")}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, createMutation.isPending && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Register Guest</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 56 : 16, paddingBottom: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },

  scroll: { flex: 1, padding: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 12, marginTop: 20,
  },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  inputBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 10, paddingHorizontal: 12, height: 48,
  },
  input: { flex: 1, fontSize: 15, color: "#0f172a" },
  multilineBox: { alignItems: "flex-start", paddingVertical: 12, height: undefined },
  multiline: { minHeight: 72 },

  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  typeBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  typeBtnText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  typeBtnTextActive: { color: "#1d4ed8" },

  submitBtn: {
    backgroundColor: "#2563eb", borderRadius: 12, padding: 16,
    alignItems: "center", marginTop: 24,
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
