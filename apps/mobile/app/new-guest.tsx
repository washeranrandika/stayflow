/**
 * StayFlow Mobile – New Guest / Walk-in Registration Screen
 * Creates a guest profile with live ID validation, NIC decoding, and duplicate lookup.
 */
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  User, Phone, Mail, CreditCard, MapPin, ChevronLeft,
  CheckCircle2, AlertCircle, Sparkles, UserCheck, Calendar, Info
} from "lucide-react-native";
import { validateGuestId, DecodedIdInfo } from "@/lib/idValidation";

interface GuestForm {
  full_name: string;
  phone: string;
  email: string;
  id_type: string;
  id_number: string;
  nationality: string;
  address: string;
  date_of_birth?: string;
  gender?: string;
}

const ID_TYPES = [
  { key: "NATIONAL_ID", label: "National ID (NIC)" },
  { key: "PASSPORT", label: "Passport" },
  { key: "DRIVING_LICENSE", label: "Driving License" },
  { key: "OTHER", label: "Other" },
];

export default function NewGuestScreen() {
  const router = useRouter();
  const [form, setForm] = useState<GuestForm>({
    full_name: "",
    phone: "",
    email: "",
    id_type: "NATIONAL_ID",
    id_number: "",
    nationality: "Sri Lankan",
    address: "",
  });

  const [idValidation, setIdValidation] = useState<DecodedIdInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Validate ID number on change
  useEffect(() => {
    if (!form.id_number.trim()) {
      setIdValidation(null);
      return;
    }
    const result = validateGuestId(form.id_type, form.id_number);
    setIdValidation(result);

    // Auto-update Date of Birth and Gender if decoded from NIC
    if (result.isValid && result.dob) {
      setForm((prev) => ({
        ...prev,
        date_of_birth: result.dob,
        gender: result.gender,
      }));
    }
  }, [form.id_type, form.id_number]);

  // Debounced search for existing guest by ID Number or Phone
  useEffect(() => {
    const timer = setTimeout(() => {
      const term = form.id_number.trim() || form.phone.trim();
      if (term.length >= 4) {
        setSearchTerm(term);
      } else {
        setSearchTerm("");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [form.id_number, form.phone]);

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["guest-lookup", searchTerm],
    queryFn: () => api.get(`/guests?search=${encodeURIComponent(searchTerm)}&page_size=3`),
    enabled: searchTerm.length >= 4,
  });

  const existingGuests: any[] = searchResults?.data?.data || [];
  const matchedGuest = existingGuests.find((g) =>
    (form.id_number && g.notes?.includes(form.id_number.trim())) ||
    (form.phone && g.phone === form.phone.trim())
  ) || (existingGuests.length > 0 ? existingGuests[0] : null);

  const set = (key: keyof GuestForm) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleAutofillFromExisting = (guest: any) => {
    setForm((prev) => ({
      ...prev,
      full_name: guest.full_name || prev.full_name,
      phone: guest.phone || prev.phone,
      email: guest.email || prev.email,
      address: guest.address || prev.address,
      date_of_birth: guest.date_of_birth || prev.date_of_birth,
    }));
    Alert.alert("✨ Guest Profile Loaded", `Details for ${guest.full_name} have been auto-filled.`);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/guests", data),
    onSuccess: (res: any) => {
      const guest = res.data?.data;
      Alert.alert(
        "✅ Guest Created",
        `${guest?.full_name} has been successfully registered.`,
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

    if (form.id_number.trim() && idValidation && !idValidation.isValid) {
      Alert.alert("Invalid ID", idValidation.errorMessage || "Please provide a valid ID number.");
      return;
    }

    const payload: any = { full_name: form.full_name.trim() };
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;

    // Persist ID and nationality into structured notes
    const idTag = form.id_number.trim()
      ? `[ID: ${form.id_type} - ${form.id_number.trim()}${form.gender ? ` | ${form.gender}` : ""}]`
      : "";
    const natTag = form.nationality.trim() ? `[Nationality: ${form.nationality.trim()}]` : "";
    payload.notes = [idTag, natTag].filter(Boolean).join(" ");

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
        <Text style={styles.headerTitle}>New Guest Registration</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Existing Guest Match Banner */}
        {matchedGuest && (
          <View style={styles.matchBanner}>
            <View style={styles.matchIconCircle}>
              <UserCheck size={20} color="#1d4ed8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.matchTitle}>Existing Guest Found</Text>
              <Text style={styles.matchSub}>
                {matchedGuest.full_name} {matchedGuest.phone ? `(${matchedGuest.phone})` : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.autofillBtn}
              onPress={() => handleAutofillFromExisting(matchedGuest)}
            >
              <Sparkles size={14} color="#fff" />
              <Text style={styles.autofillBtnText}>Autofill</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Identity Document Section (Top for early verification) ── */}
        <Text style={styles.sectionTitle}>1. Identity & Verification</Text>

        <View style={styles.field}>
          <Text style={styles.label}>ID Document Type</Text>
          <View style={styles.typeRow}>
            {ID_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, form.id_type === t.key && styles.typeBtnActive]}
                onPress={() => set("id_type")(t.key)}
              >
                <Text style={[styles.typeBtnText, form.id_type === t.key && styles.typeBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.label}>ID / Document Number</Text>
            {isSearching && <ActivityIndicator size="small" color="#2563eb" />}
          </View>
          <View style={[
            styles.inputBox,
            idValidation && (idValidation.isValid ? styles.inputValid : styles.inputInvalid)
          ]}>
            <CreditCard size={18} color={idValidation?.isValid ? "#16a34a" : (idValidation?.errorMessage ? "#dc2626" : "#94a3b8")} />
            <TextInput
              style={styles.input}
              placeholder={form.id_type === "NATIONAL_ID" ? "e.g. 981234567V or 199812345678" : "e.g. N1234567"}
              value={form.id_number}
              onChangeText={set("id_number")}
              autoCapitalize="characters"
            />
            {idValidation && (
              idValidation.isValid ? (
                <CheckCircle2 size={18} color="#16a34a" />
              ) : (
                <AlertCircle size={18} color="#dc2626" />
              )
            )}
          </View>

          {/* Validation Feedback Banner */}
          {idValidation && !idValidation.isValid && idValidation.errorMessage && (
            <View style={styles.errorPill}>
              <AlertCircle size={13} color="#b91c1c" />
              <Text style={styles.errorPillText}>{idValidation.errorMessage}</Text>
            </View>
          )}

          {/* Decoded Details from NIC */}
          {idValidation && idValidation.isValid && idValidation.dob && (
            <View style={styles.decodedCard}>
              <View style={styles.decodedHeader}>
                <Sparkles size={15} color="#15803d" />
                <Text style={styles.decodedHeaderText}>
                  Verified {idValidation.isOldNic ? "Old (9+V)" : "New (12-Digit)"} National ID
                </Text>
              </View>

              <View style={styles.decodedGrid}>
                <View style={styles.decodedItem}>
                  <Text style={styles.decodedLabel}>Date of Birth</Text>
                  <Text style={styles.decodedValue}>🎂 {idValidation.dobFormatted}</Text>
                </View>

                <View style={styles.decodedItem}>
                  <Text style={styles.decodedLabel}>Gender</Text>
                  <Text style={styles.decodedValue}>
                    {idValidation.gender === "Female" ? "👩 Female" : "👨 Male"}
                  </Text>
                </View>

                <View style={styles.decodedItem}>
                  <Text style={styles.decodedLabel}>Approx. Age</Text>
                  <Text style={styles.decodedValue}>⏳ {idValidation.age} yrs</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Personal Info Section ── */}
        <Text style={styles.sectionTitle}>2. Guest Details</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name *</Text>
          <View style={styles.inputBox}>
            <User size={16} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="e.g. Kasun Fernando"
              value={form.full_name}
              onChangeText={set("full_name")}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputBox}>
              <Phone size={16} color="#94a3b8" />
              <TextInput
                style={styles.input}
                placeholder="+94 77 123 4567"
                value={form.phone}
                onChangeText={set("phone")}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Nationality</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sri Lankan"
                value={form.nationality}
                onChangeText={set("nationality")}
                autoCapitalize="words"
              />
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
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

        {/* Address */}
        <View style={styles.field}>
          <Text style={styles.label}>Address / City</Text>
          <View style={[styles.inputBox, styles.multilineBox]}>
            <MapPin size={16} color="#94a3b8" style={{ marginTop: 2 }} />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Street, City, Postal Code"
              value={form.address}
              onChangeText={set("address")}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, createMutation.isPending && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Register Verified Guest</Text>
            </View>
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
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },

  scroll: { flex: 1, padding: 16 },

  // Returning Guest Banner
  matchBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#eff6ff", borderWidth: 1.5, borderColor: "#bfdbfe",
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  matchIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  matchTitle: { fontSize: 13, fontWeight: "800", color: "#1e40af" },
  matchSub: { fontSize: 11, color: "#3b82f6", marginTop: 1 },
  autofillBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#2563eb", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  autofillBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  sectionTitle: {
    fontSize: 12, fontWeight: "800", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 10, marginTop: 14,
  },
  field: { marginBottom: 12 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 12, fontWeight: "700", color: "#334155", marginBottom: 5 },
  inputBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 10, paddingHorizontal: 12, height: 46,
  },
  inputValid: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  inputInvalid: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  input: { flex: 1, fontSize: 14, color: "#0f172a" },
  multilineBox: { alignItems: "flex-start", paddingVertical: 10, height: undefined },
  multiline: { minHeight: 48 },

  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  typeBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  typeBtnText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  typeBtnTextActive: { color: "#1d4ed8" },

  // Decoded Card
  decodedCard: {
    backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0",
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  decodedHeader: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8,
  },
  decodedHeaderText: { fontSize: 12, fontWeight: "800", color: "#15803d" },
  decodedGrid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  decodedItem: { flex: 1 },
  decodedLabel: { fontSize: 10, fontWeight: "700", color: "#166534" },
  decodedValue: { fontSize: 12, fontWeight: "800", color: "#14532d", marginTop: 2 },

  errorPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef2f2", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, marginTop: 4,
  },
  errorPillText: { fontSize: 11, color: "#b91c1c", fontWeight: "600" },

  submitBtn: {
    backgroundColor: "#2563eb", borderRadius: 12, padding: 15,
    alignItems: "center", justifyContent: "center", marginTop: 18,
    shadowColor: "#2563eb", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
