import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, Switch
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useRouter } from "expo-router";
import {
  BedDouble, CheckCircle2, Clock, LogOut, DollarSign,
  Plus, Trash2, Calendar, AlertTriangle, FileText,
  ChevronRight, RefreshCw, Tag, ShieldCheck, Key, UserCheck
} from "lucide-react-native";

interface DamageItem {
  id: string;
  description: string;
  amount: number;
  notes?: string;
}

const DAMAGE_PRESETS = [
  { label: "Broken Glassware", amount: 800 },
  { label: "Stained Bed Linen", amount: 1500 },
  { label: "Lost Room Key", amount: 2000 },
  { label: "Mini-bar Items", amount: 1000 },
  { label: "Wall / Furniture Mark", amount: 3000 },
];

export default function MobileCheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStay, setSelectedStay] = useState<any | null>(null);

  // Form states
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [discount, setDiscount] = useState<string>("");
  const [specialNotes, setSpecialNotes] = useState<string>("");
  
  // Front Desk Handover Checklist
  const [docReturnedConfirmed, setDocReturnedConfirmed] = useState(true);
  const [keyCollectedConfirmed, setKeyCollectedConfirmed] = useState(true);

  // Damage & Extra charges state
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageDesc, setDamageDesc] = useState("");
  const [damageAmount, setDamageAmount] = useState("");

  // Extension state
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extensionHours, setExtensionHours] = useState<number | null>(null);
  const [extensionDays, setExtensionDays] = useState<number | null>(null);
  const [extensionNotes, setExtensionNotes] = useState("");

  // Queries
  const { data, isLoading, refetch: refetchStays } = useQuery({
    queryKey: ["mobileActiveStays"],
    queryFn: () => apiClient.get("/stays/active"),
  });

  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ["mobileStayPricing", selectedStay?.id],
    queryFn: () => apiClient.get(`/stays/${selectedStay?.id}/pricing`),
    enabled: !!selectedStay,
  });

  const activeStays = data?.data?.data || [];
  const basePricing = pricingData?.data?.data;

  // Calculate live dynamic totals
  const parsedDiscount = parseFloat(discount) || 0;
  const damageTotal = damageItems.reduce((acc, item) => acc + item.amount, 0);
  const calculatedGrandTotal = Math.max(
    0,
    (basePricing?.grand_total || 0) + damageTotal - parsedDiscount
  );

  // Extend stay mutation
  const extendMutation = useMutation({
    mutationFn: async ({ stayId, newCheckout, notes }: { stayId: string; newCheckout: string; notes?: string }) => {
      return await apiClient.patch(`/stays/${stayId}/extend`, {
        expected_checkout: newCheckout,
        notes: notes || undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["mobileActiveStays"] });
      queryClient.invalidateQueries({ queryKey: ["mobileStayPricing", selectedStay?.id] });
      setSelectedStay(res.data?.data);
      setShowExtendForm(false);
      setExtensionHours(null);
      setExtensionDays(null);
      setExtensionNotes("");
      Alert.alert("Success", "Stay duration has been extended!");
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Failed to extend stay";
      Alert.alert("Extension Failed", msg);
    },
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const notesParts = [];
      if (docReturnedConfirmed) {
        notesParts.push("[ID/DOCS: RETURNED TO GUEST]");
      }
      if (keyCollectedConfirmed) {
        notesParts.push("[KEY: COLLECTED]");
      }
      if (specialNotes.trim()) {
        notesParts.push(specialNotes.trim());
      }

      const payload: any = {
        discount: parsedDiscount,
        notes: notesParts.length > 0 ? notesParts.join(" | ") : undefined,
        damage_items: damageItems.length > 0 ? damageItems.map(d => ({
          description: d.description,
          amount: d.amount,
          notes: d.notes,
        })) : undefined,
      };

      const res = await apiClient.post(`/stays/${selectedStay.id}/checkout`, payload);
      const invoiceId = res.data?.data?.invoice_id;

      if (invoiceId && calculatedGrandTotal > 0) {
        await apiClient.post(`/payments/invoices/${invoiceId}/payments`, {
          payment_method: paymentMethod,
          amount: calculatedGrandTotal,
        });
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobileActiveStays"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert(
        "✅ Checkout Complete",
        `Room ${selectedStay.room?.room_number} is now marked CLEANING. Keys collected & invoice settled.`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Checkout failed";
      Alert.alert("Checkout Error", msg);
    },
  });

  const handleAddDamageItem = (desc: string, amt: number) => {
    if (!desc.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert("Error", "Please provide a valid description and amount.");
      return;
    }
    setDamageItems(prev => [
      ...prev,
      { id: Date.now().toString(), description: desc.trim(), amount: amt }
    ]);
    setDamageDesc("");
    setDamageAmount("");
    setShowDamageForm(false);
  };

  const handleRemoveDamageItem = (id: string) => {
    setDamageItems(prev => prev.filter(item => item.id !== id));
  };

  const handleApplyExtension = (hours?: number, days?: number) => {
    if (!selectedStay) return;
    const currentCheckout = new Date(selectedStay.expected_checkout || selectedStay.actual_check_in);
    const newCheckout = new Date(currentCheckout);

    if (hours) {
      newCheckout.setHours(newCheckout.getHours() + hours);
    }
    if (days) {
      newCheckout.setDate(newCheckout.getDate() + days);
    }

    extendMutation.mutate({
      stayId: selectedStay.id,
      newCheckout: newCheckout.toISOString(),
      notes: extensionNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const formatShortDate = (d?: Date | string | null) => {
    if (!d) return "—";
    const dateObj = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return String(d);
    return `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}`;
  };

  const formatShortTime = (d?: Date | string | null) => {
    if (!d) return "";
    const dateObj = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return "";
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  // Extract retained ID info if present in stay notes
  const hasRetainedId = selectedStay?.notes?.includes("RETAINED_ID") || selectedStay?.notes?.includes("Physical ID");
  const checkInTime = selectedStay ? new Date(selectedStay.actual_check_in) : null;
  const expectedCheckoutTime = selectedStay ? new Date(selectedStay.expected_checkout) : null;
  const now = new Date();
  const isOverdue = expectedCheckoutTime && now > expectedCheckoutTime;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {!selectedStay ? (
        <View style={styles.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={styles.title}>Active Stays ({activeStays.length})</Text>
            <TouchableOpacity onPress={() => refetchStays()} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <RefreshCw size={14} color="#2563eb" />
              <Text style={{ color: "#2563eb", fontSize: 13, fontWeight: "600" }}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {activeStays.length === 0 ? (
            <View style={styles.emptyCard}>
              <BedDouble size={44} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Active Stays</Text>
              <Text style={styles.emptyText}>All rooms are currently vacant or cleaning.</Text>
            </View>
          ) : (
            activeStays.map((stay: any) => (
              <TouchableOpacity
                key={stay.id}
                style={styles.stayCard}
                onPress={() => {
                  setSelectedStay(stay);
                  setDamageItems([]);
                  setDiscount("");
                  setSpecialNotes("");
                }}
              >
                <View style={styles.stayHeader}>
                  <View style={styles.roomBadge}>
                    <Text style={styles.roomBadgeText}>Room {stay.room?.room_number || "—"}</Text>
                  </View>
                  <Text style={styles.stayTypeBadge}>{stay.stay_type}</Text>
                </View>
                <Text style={styles.guestName}>{stay.primary_guest?.full_name || "Guest"}</Text>
                
                <View style={styles.stayFooter}>
                  <Text style={styles.timeText}>
                    In: {formatShortDate(stay.actual_check_in)} {formatShortTime(stay.actual_check_in)}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Text style={styles.checkoutBtnText}>Checkout</Text>
                    <ChevronRight size={14} color="#2563eb" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <TouchableOpacity onPress={() => setSelectedStay(null)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back to active stays</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            {/* Header info */}
            <View style={styles.summaryHeader}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.summaryTitle}>Room {selectedStay.room?.room_number}</Text>
                <View style={styles.roomBadge}>
                  <Text style={styles.roomBadgeText}>{selectedStay.stay_type}</Text>
                </View>
              </View>
              <Text style={styles.summarySubtitle}>Guest: {selectedStay.primary_guest?.full_name}</Text>
            </View>

            {/* Attendance & Discharge Timeline */}
            <View style={styles.timelineBox}>
              <View style={styles.timelineHeader}>
                <Clock size={16} color="#0284c7" />
                <Text style={styles.timelineTitle}>Attendance & Discharge Timeline</Text>
              </View>
              <View style={styles.timelineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>🟢 Attendance (Check-in)</Text>
                  <Text style={styles.timelineVal}>
                    {formatShortTime(checkInTime)}
                  </Text>
                  <Text style={styles.timelineSub}>{formatShortDate(checkInTime)}</Text>
                </View>
                <View style={styles.timelineDivider} />
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={styles.timelineLabel}>🔴 Discharge (Expected)</Text>
                  <Text style={[styles.timelineVal, isOverdue && { color: "#dc2626" }]}>
                    {formatShortTime(expectedCheckoutTime)}
                  </Text>
                  <Text style={styles.timelineSub}>{formatShortDate(expectedCheckoutTime)}</Text>
                </View>
              </View>
              {isOverdue && (
                <View style={styles.overdueBadge}>
                  <AlertTriangle size={13} color="#dc2626" />
                  <Text style={styles.overdueText}>Past expected discharge time. Overtime rate applied.</Text>
                </View>
              )}
            </View>

            {/* FRONT DESK HANDOVER CHECKLIST */}
            <View style={styles.handoverCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <ShieldCheck size={18} color="#059669" />
                <Text style={styles.handoverTitle}>Front Desk Handover & Custody Checklist</Text>
              </View>

              {hasRetainedId && (
                <View style={styles.retainedIdAlert}>
                  <AlertTriangle size={16} color="#b45309" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.retainedIdAlertTitle}>⚠️ Physical ID Retained at Front Desk</Text>
                    <Text style={styles.retainedIdAlertDesc}>
                      {selectedStay.notes || "Check reception safe/envelope to return guest document."}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.checkRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.checkLabel}>📁 Return Physical ID / Documents to Guest</Text>
                  <Text style={styles.checkDesc}>Verify that all held passports/NICs are returned.</Text>
                </View>
                <Switch
                  value={docReturnedConfirmed}
                  onValueChange={setDocReturnedConfirmed}
                  trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                  thumbColor={docReturnedConfirmed ? "#16a34a" : "#f1f5f9"}
                />
              </View>

              <View style={[styles.checkRow, { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, marginTop: 8 }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.checkLabel}>🔑 Collect Room Key / Keycard</Text>
                  <Text style={styles.checkDesc}>Ensure all room keys are handed back.</Text>
                </View>
                <Switch
                  value={keyCollectedConfirmed}
                  onValueChange={setKeyCollectedConfirmed}
                  trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                  thumbColor={keyCollectedConfirmed ? "#16a34a" : "#f1f5f9"}
                />
              </View>
            </View>

            {/* 1. EXTEND STAY / ADDITIONAL HOURS / DATES */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setShowExtendForm(!showExtendForm)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Calendar size={18} color="#2563eb" />
                  <Text style={styles.accordionTitle}>Need to Extend Stay / Add Hours?</Text>
                </View>
                <Text style={{ color: "#2563eb", fontWeight: "700", fontSize: 13 }}>
                  {showExtendForm ? "Close" : "+ Extend"}
                </Text>
              </TouchableOpacity>

              {showExtendForm && (
                <View style={styles.accordionBody}>
                  <Text style={styles.helperText}>
                    Select additional hours or days to postpone checkout and adjust billing:
                  </Text>
                  <View style={styles.presetGrid}>
                    <TouchableOpacity
                      style={styles.extendPresetBtn}
                      onPress={() => handleApplyExtension(1, 0)}
                      disabled={extendMutation.isPending}
                    >
                      <Text style={styles.extendPresetText}>+1 Hour</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.extendPresetBtn}
                      onPress={() => handleApplyExtension(2, 0)}
                      disabled={extendMutation.isPending}
                    >
                      <Text style={styles.extendPresetText}>+2 Hours</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.extendPresetBtn}
                      onPress={() => handleApplyExtension(0, 1)}
                      disabled={extendMutation.isPending}
                    >
                      <Text style={styles.extendPresetText}>+1 Night</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.extendPresetBtn}
                      onPress={() => handleApplyExtension(0, 2)}
                      disabled={extendMutation.isPending}
                    >
                      <Text style={styles.extendPresetText}>+2 Nights</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="Extension reason or notes (optional)"
                    value={extensionNotes}
                    onChangeText={setExtensionNotes}
                  />
                  {extendMutation.isPending && (
                    <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 8 }} />
                  )}
                </View>
              )}
            </View>

            {/* 2. DAMAGE REPORTS & EXTRA CHARGES */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setShowDamageForm(!showDamageForm)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} color="#d97706" />
                  <Text style={styles.accordionTitle}>Damage / Extras Charges ({damageItems.length})</Text>
                </View>
                <Text style={{ color: "#d97706", fontWeight: "700", fontSize: 13 }}>
                  {showDamageForm ? "Cancel" : "+ Add Charge"}
                </Text>
              </TouchableOpacity>

              {damageItems.map((item) => (
                <View key={item.id} style={styles.damageItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.damageItemDesc}>⚠️ {item.description}</Text>
                    <Text style={styles.damageItemAmt}>+ Rs. {item.amount.toLocaleString()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveDamageItem(item.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {showDamageForm && (
                <View style={styles.accordionBody}>
                  <Text style={styles.helperText}>Quick Presets:</Text>
                  <View style={styles.presetWrap}>
                    {DAMAGE_PRESETS.map((p) => (
                      <TouchableOpacity
                        key={p.label}
                        style={styles.chip}
                        onPress={() => handleAddDamageItem(p.label, p.amount)}
                      >
                        <Text style={styles.chipText}>{p.label} (Rs. {p.amount})</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.helperText, { marginTop: 10 }]}>Or Custom Charge:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Damage / item description (e.g. Broken AC Remote)"
                    value={damageDesc}
                    onChangeText={setDamageDesc}
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 6 }]}
                    placeholder="Charge Amount (LKR)"
                    keyboardType="numeric"
                    value={damageAmount}
                    onChangeText={setDamageAmount}
                  />
                  <TouchableOpacity
                    style={styles.addDamageBtn}
                    onPress={() => handleAddDamageItem(damageDesc, parseFloat(damageAmount) || 0)}
                  >
                    <Text style={styles.addDamageBtnText}>✓ Add Fee to Invoice</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 3. SPECIAL NOTES */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Special Notes & Guest Feedback</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: "top" }]}
                placeholder="e.g. Guest left early, requested receipt emailed, keys returned."
                multiline
                value={specialNotes}
                onChangeText={setSpecialNotes}
              />
            </View>

            {/* 4. BILLING BREAKDOWN */}
            <View style={styles.billingCard}>
              <Text style={styles.sectionHeader}>Billing Breakdown</Text>
              {pricingLoading ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
              ) : (
                <>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Room Charge</Text>
                    <Text style={styles.billVal}>Rs. {Number(basePricing?.room_charge || 0).toLocaleString()}</Text>
                  </View>

                  {(basePricing?.overtime_charge > 0) && (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: "#dc2626" }]}>Late Checkout / Overtime</Text>
                      <Text style={[styles.billVal, { color: "#dc2626" }]}>+ Rs. {Number(basePricing?.overtime_charge).toLocaleString()}</Text>
                    </View>
                  )}

                  {(basePricing?.extra_guest_charge > 0) && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Extra Guests Fee</Text>
                      <Text style={styles.billVal}>+ Rs. {Number(basePricing?.extra_guest_charge).toLocaleString()}</Text>
                    </View>
                  )}

                  {(basePricing?.service_total > 0) && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Room Services & Orders</Text>
                      <Text style={styles.billVal}>+ Rs. {Number(basePricing?.service_total).toLocaleString()}</Text>
                    </View>
                  )}

                  {damageTotal > 0 && (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: "#d97706" }]}>Damage / Extras ({damageItems.length})</Text>
                      <Text style={[styles.billVal, { color: "#d97706" }]}>+ Rs. {damageTotal.toLocaleString()}</Text>
                    </View>
                  )}

                  <View style={[styles.billRow, { marginTop: 6, alignItems: "center" }]}>
                    <Text style={styles.billLabel}>Discount / Waiver</Text>
                    <TextInput
                      style={styles.discountInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={discount}
                      onChangeText={setDiscount}
                    />
                  </View>

                  <View style={styles.divider} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Due</Text>
                    <Text style={styles.totalVal}>Rs. {calculatedGrandTotal.toLocaleString()}</Text>
                  </View>
                </>
              )}
            </View>

            {/* 5. PAYMENT METHOD */}
            <Text style={styles.fieldLabel}>Payment Settlement Method</Text>
            <View style={styles.paymentRow}>
              {["CASH", "CARD", "ONLINE"].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.paymentBtn, paymentMethod === m && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text style={[styles.paymentBtnText, paymentMethod === m && styles.paymentBtnTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.checkoutActionBtn, checkoutMutation.isPending && { opacity: 0.7 }]}
              onPress={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <LogOut size={18} color="#fff" />
                  <Text style={styles.checkoutActionBtnText}>
                    Confirm & Complete Checkout (Rs. {calculatedGrandTotal.toLocaleString()})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: { padding: 16 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  
  // Empty card
  emptyCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 32,
    alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", marginTop: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginTop: 12 },
  emptyText: { fontSize: 13, color: "#64748b", marginTop: 4, textAlign: "center" },

  // Stay card
  stayCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 12,
  },
  stayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roomBadge: { backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roomBadgeText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
  stayTypeBadge: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  guestName: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginTop: 8 },
  stayFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9",
  },
  timeText: { fontSize: 12, color: "#64748b" },
  checkoutBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },

  // Checkout detail view
  backLink: { marginBottom: 12 },
  backLinkText: { color: "#2563eb", fontWeight: "600", fontSize: 14 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  summaryHeader: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 12 },
  summaryTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  summarySubtitle: { fontSize: 14, color: "#475569", fontWeight: "600", marginTop: 4 },

  // Timeline
  timelineBox: {
    backgroundColor: "#f0f9ff", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#bae6fd", marginTop: 12,
  },
  timelineHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  timelineTitle: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
  timelineRow: { flexDirection: "row", alignItems: "center" },
  timelineDivider: { width: 1, height: 36, backgroundColor: "#bae6fd" },
  timelineLabel: { fontSize: 10, fontWeight: "700", color: "#64748b" },
  timelineVal: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginTop: 1 },
  timelineSub: { fontSize: 10, color: "#64748b" },
  overdueBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef2f2", padding: 6, borderRadius: 6, marginTop: 8,
  },
  overdueText: { fontSize: 11, color: "#b91c1c", fontWeight: "600" },

  // Handover card
  handoverCard: {
    backgroundColor: "#f0fdf4", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#bbf7d0", marginTop: 12,
  },
  handoverTitle: { fontSize: 13, fontWeight: "700", color: "#065f46" },
  retainedIdAlert: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#fef3c7", padding: 10, borderRadius: 8, marginBottom: 10,
    borderWidth: 1, borderColor: "#fde68a",
  },
  retainedIdAlertTitle: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  retainedIdAlertDesc: { fontSize: 11, color: "#b45309", marginTop: 2 },
  checkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  checkLabel: { fontSize: 12, fontWeight: "700", color: "#1e293b" },
  checkDesc: { fontSize: 10, color: "#64748b", marginTop: 1 },

  // Accordion
  accordionBox: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12,
    marginTop: 12, overflow: "hidden", backgroundColor: "#fafafa",
  },
  accordionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 12, backgroundColor: "#fff",
  },
  accordionTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  accordionBody: { padding: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  helperText: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  presetGrid: { flexDirection: "row", gap: 6 },
  extendPresetBtn: {
    flex: 1, backgroundColor: "#eff6ff", paddingVertical: 8,
    borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "#bfdbfe",
  },
  extendPresetText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
  presetWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  chipText: { fontSize: 12, color: "#334155", fontWeight: "500" },
  damageItemRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  damageItemDesc: { fontSize: 12, fontWeight: "600", color: "#b45309" },
  damageItemAmt: { fontSize: 11, color: "#d97706", fontWeight: "700", marginTop: 2 },
  addDamageBtn: {
    backgroundColor: "#d97706", padding: 10, borderRadius: 8,
    alignItems: "center", marginTop: 8,
  },
  addDamageBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Billing
  billingCard: {
    backgroundColor: "#f8fafc", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", marginTop: 14,
  },
  sectionHeader: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  billLabel: { fontSize: 13, color: "#64748b" },
  billVal: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  discountInput: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, width: 80, textAlign: "right",
    fontSize: 13, backgroundColor: "#fff",
  },
  divider: { height: 1, backgroundColor: "#cbd5e1", marginVertical: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  totalVal: { fontSize: 18, fontWeight: "900", color: "#2563eb" },

  // Payment
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: "#fff",
  },
  paymentRow: { flexDirection: "row", gap: 8 },
  paymentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
    borderColor: "#e2e8f0", backgroundColor: "#fff", alignItems: "center",
  },
  paymentBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  paymentBtnText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  paymentBtnTextActive: { color: "#2563eb" },

  // Action Button
  checkoutActionBtn: {
    backgroundColor: "#2563eb", padding: 15, borderRadius: 12,
    alignItems: "center", marginTop: 16,
  },
  checkoutActionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
