import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useRouter } from "expo-router";
import { BedDouble, CheckCircle2, Clock, LogOut, DollarSign } from "lucide-react-native";

export default function MobileCheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStay, setSelectedStay] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const { data, isLoading } = useQuery({
    queryKey: ["mobileActiveStays"],
    queryFn: () => apiClient.get("/stays/active"),
  });

  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ["mobileStayPricing", selectedStay?.id],
    queryFn: () => apiClient.get(`/stays/${selectedStay?.id}/pricing`),
    enabled: !!selectedStay,
  });

  const activeStays = data?.data?.data || [];
  const pricing = pricingData?.data?.data;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/stays/${selectedStay.id}/checkout`, { discount: 0 });
      const invoiceId = res.data?.data?.invoice_id;
      if (invoiceId && pricing?.grand_total > 0) {
        await apiClient.post(`/payments/invoices/${invoiceId}/payments`, {
          payment_method: paymentMethod,
          amount: pricing.grand_total,
        });
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobileActiveStays"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      Alert.alert("Success", "Stay checked out. Room is now CLEANING.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.error?.message || "Checkout failed");
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {!selectedStay ? (
        <View style={styles.section}>
          <Text style={styles.title}>Select Active Stay to Checkout</Text>
          {activeStays.length === 0 ? (
            <View style={styles.emptyCard}>
              <BedDouble size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>No active stays to checkout right now.</Text>
            </View>
          ) : (
            activeStays.map((stay: any) => (
              <TouchableOpacity
                key={stay.id}
                style={styles.stayCard}
                onPress={() => setSelectedStay(stay)}
              >
                <View style={styles.stayHeader}>
                  <View style={styles.roomBadge}>
                    <Text style={styles.roomBadgeText}>Room {stay.room?.room_number || "—"}</Text>
                  </View>
                  <Text style={styles.stayType}>{stay.stay_type}</Text>
                </View>
                <Text style={styles.guestName}>{stay.primary_guest?.full_name || "Guest"}</Text>
                <View style={styles.stayFooter}>
                  <Text style={styles.timeText}>
                    In: {new Date(stay.actual_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <Text style={styles.checkoutBtnText}>Select for Checkout →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <TouchableOpacity onPress={() => setSelectedStay(null)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Choose a different room</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Room {selectedStay.room?.room_number} Checkout</Text>
              <Text style={styles.summarySubtitle}>{selectedStay.primary_guest?.full_name}</Text>
            </View>

            {pricingLoading ? (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 20 }} />
            ) : pricing ? (
              <View style={styles.billDetails}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Room Charge</Text>
                  <Text style={styles.billValue}>Rs. {pricing.room_charge?.toLocaleString()}</Text>
                </View>
                {pricing.extra_hour_charge > 0 && (
                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { color: "#e11d48" }]}>Overtime Extra Hours</Text>
                    <Text style={[styles.billValue, { color: "#e11d48" }]}>Rs. {pricing.extra_hour_charge?.toLocaleString()}</Text>
                  </View>
                )}
                {pricing.services_total > 0 && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Folio Services & Extras</Text>
                    <Text style={styles.billValue}>Rs. {pricing.services_total?.toLocaleString()}</Text>
                  </View>
                )}
                <View style={[styles.billRow, styles.billTotalRow]}>
                  <Text style={styles.billTotalLabel}>Grand Total</Text>
                  <Text style={styles.billTotalValue}>Rs. {pricing.grand_total?.toLocaleString()}</Text>
                </View>

                {/* Payment Selection */}
                <Text style={styles.fieldLabel}>Payment Method</Text>
                <View style={styles.methodSelector}>
                  {["CASH", "CARD", "BANK_TRANSFER", "QR"].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.methodBtn,
                        paymentMethod === m && styles.methodBtnActive
                      ]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text style={[
                        styles.methodBtnText,
                        paymentMethod === m && styles.methodBtnTextActive
                      ]}>
                        {m.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.confirmCheckoutBtn}
                  onPress={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                >
                  <LogOut size={18} color="#fff" />
                  <Text style={styles.confirmCheckoutText}>
                    {checkoutMutation.isPending ? "Finalizing..." : "Confirm & Settle Checkout"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  section: { padding: 16 },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  emptyCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 32, alignItems: "center",
    borderWidth: 1, borderColor: "#e2e8f0", marginTop: 10,
  },
  emptyText: { color: "#64748b", marginTop: 8, fontSize: 14 },
  stayCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  stayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roomBadge: { backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roomBadgeText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  stayType: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  guestName: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginTop: 8 },
  stayFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  timeText: { fontSize: 12, color: "#64748b" },
  checkoutBtnText: { fontSize: 12, color: "#2563eb", fontWeight: "700" },
  backLink: { marginBottom: 12 },
  backLinkText: { color: "#2563eb", fontSize: 14, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  summaryHeader: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  summaryTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  summarySubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  billDetails: { marginTop: 16 },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  billLabel: { fontSize: 14, color: "#64748b" },
  billValue: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  billTotalRow: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 10, marginTop: 6 },
  billTotalLabel: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  billTotalValue: { fontSize: 18, fontWeight: "800", color: "#2563eb" },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 16, marginBottom: 8 },
  methodSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff",
  },
  methodBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  methodBtnText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  methodBtnTextActive: { color: "#fff" },
  confirmCheckoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#0f172a", borderRadius: 10, padding: 14, marginTop: 20, gap: 8,
  },
  confirmCheckoutText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
