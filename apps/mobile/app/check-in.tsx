import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { BedDouble, User, Clock, ChevronRight } from "lucide-react-native";

export default function MobileCheckInScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [stayType, setStayType] = useState("OVERNIGHT");
  const [numGuests, setNumGuests] = useState("1");
  const [checkoutDays, setCheckoutDays] = useState("1"); // days from now

  const { data: propsData } = useQuery({ queryKey: ["properties"], queryFn: () => api.get("/properties") });
  const propertyId = propsData?.data?.data?.[0]?.id;

  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ["rooms", propertyId, "AVAILABLE"],
    queryFn: () => api.get(`/rooms/by-property/${propertyId}`, { params: { status: "AVAILABLE" } }),
    enabled: !!propertyId,
  });

  const { data: guestsData, isLoading: loadingGuests } = useQuery({
    queryKey: ["guests"],
    queryFn: () => api.get("/guests"),
  });

  const checkInMutation = useMutation({
    mutationFn: (data: any) => api.post("/stays/check-in", data),
    onSuccess: () => {
      Alert.alert("Success", "Guest checked in successfully");
      router.back();
    },
    onError: (err: any) => {
      Alert.alert("Check-in Failed", err.response?.data?.error?.message || "An error occurred");
    },
  });

  const handleComplete = () => {
    if (!selectedRoom || !selectedGuest || !checkoutDays) return;
    
    // Calculate expected checkout date
    const d = new Date();
    d.setDate(d.getDate() + parseInt(checkoutDays));
    // Set to standard checkout time (e.g. 11:00 AM)
    d.setHours(11, 0, 0, 0);

    checkInMutation.mutate({
      property_id: propertyId,
      room_id: selectedRoom.id,
      primary_guest_id: selectedGuest.id,
      stay_type: stayType,
      num_guests: parseInt(numGuests),
      expected_checkout: d.toISOString(),
    });
  };

  return (
    <View style={styles.container}>
      {/* Header Tabs */}
      <View style={styles.stepper}>
        <View style={[styles.step, step >= 1 && styles.stepActive]}>
          <Text style={[styles.stepText, step >= 1 && styles.stepTextActive]}>1. Room</Text>
        </View>
        <View style={[styles.step, step >= 2 && styles.stepActive]}>
          <Text style={[styles.stepText, step >= 2 && styles.stepTextActive]}>2. Guest</Text>
        </View>
        <View style={[styles.step, step >= 3 && styles.stepActive]}>
          <Text style={[styles.stepText, step >= 3 && styles.stepTextActive]}>3. Details</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {step === 1 && (
          <View>
            <Text style={styles.title}>Select Available Room</Text>
            {loadingRooms ? <ActivityIndicator style={{marginTop: 20}} /> : (
              <View style={styles.grid}>
                {roomsData?.data?.data?.map((r: any) => (
                  <TouchableOpacity 
                    key={r.id} 
                    style={[styles.roomCard, selectedRoom?.id === r.id && styles.roomCardSelected]}
                    onPress={() => setSelectedRoom(r)}
                  >
                    <Text style={[styles.roomNumber, selectedRoom?.id === r.id && styles.roomTextSelected]}>{r.room_number}</Text>
                    <Text style={[styles.roomType, selectedRoom?.id === r.id && styles.roomTextSelected]}>{r.room_type.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity 
              style={[styles.btn, !selectedRoom && styles.btnDisabled]} 
              disabled={!selectedRoom}
              onPress={() => setStep(2)}
            >
              <Text style={styles.btnText}>Continue to Guest</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.title}>Select Guest</Text>
            {loadingGuests ? <ActivityIndicator style={{marginTop: 20}} /> : (
              <View style={styles.list}>
                {guestsData?.data?.data?.items?.map((g: any) => (
                  <TouchableOpacity 
                    key={g.id} 
                    style={[styles.guestCard, selectedGuest?.id === g.id && styles.guestCardSelected]}
                    onPress={() => setSelectedGuest(g)}
                  >
                    <Text style={[styles.guestName, selectedGuest?.id === g.id && styles.guestTextSelected]}>{g.full_name}</Text>
                    <Text style={[styles.guestPhone, selectedGuest?.id === g.id && styles.guestTextSelected]}>{g.phone || g.email}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}>
                <Text style={styles.btnSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, !selectedGuest && styles.btnDisabled, { flex: 1, marginLeft: 12 }]} 
                disabled={!selectedGuest}
                onPress={() => setStep(3)}
              >
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.title}>Stay Details</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Stay Type</Text>
              <View style={styles.typeRow}>
                {["HOURLY", "DAY_USE", "OVERNIGHT"].map(t => (
                  <TouchableOpacity 
                    key={t}
                    style={[styles.typeBtn, stayType === t && styles.typeBtnActive]}
                    onPress={() => setStayType(t)}
                  >
                    <Text style={[styles.typeBtnText, stayType === t && styles.typeBtnTextActive]}>
                      {t.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Number of Guests</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric"
                value={numGuests}
                onChangeText={setNumGuests}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Days to stay</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric"
                value={checkoutDays}
                onChangeText={setCheckoutDays}
              />
            </View>

            <View style={styles.row}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(2)}>
                <Text style={styles.btnSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, checkInMutation.isPending && styles.btnDisabled, { flex: 1, marginLeft: 12 }]} 
                disabled={checkInMutation.isPending}
                onPress={handleComplete}
              >
                {checkInMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Complete Check-in</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  stepper: { flexDirection: "row", padding: 16, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  step: { flex: 1, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent", alignItems: "center" },
  stepActive: { borderBottomColor: "#2563eb" },
  stepText: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  stepTextActive: { color: "#2563eb" },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 30 },
  roomCard: { 
    width: "48%", padding: 16, borderRadius: 12, borderWidth: 1, 
    borderColor: "#e2e8f0", backgroundColor: "#f8fafc" 
  },
  roomCardSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  roomNumber: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  roomType: { fontSize: 13, color: "#64748b", marginTop: 4 },
  roomTextSelected: { color: "#1d4ed8" },
  list: { gap: 10, marginBottom: 30 },
  guestCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc" },
  guestCardSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  guestName: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  guestPhone: { fontSize: 13, color: "#64748b", marginTop: 4 },
  guestTextSelected: { color: "#1d4ed8" },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, fontSize: 16 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  typeBtnText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  typeBtnTextActive: { color: "#1d4ed8" },
  row: { flexDirection: "row", marginTop: 10 },
  btn: { backgroundColor: "#2563eb", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnSecondary: { padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: "#cbd5e1", width: 100 },
  btnSecondaryText: { color: "#334155", fontSize: 16, fontWeight: "600" },
});
