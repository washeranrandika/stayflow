/**
 * StayFlow Mobile – Guests Directory Screen
 * Complete guest management with search, property scoping, live pull-to-refresh,
 * detailed guest cards, profile modal, and new guest registration quick action.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Search,
  Phone,
  Mail,
  MapPin,
  UserPlus,
  Building2,
  Calendar,
  FileText,
  X,
  RefreshCw,
  User,
  ShieldAlert,
} from "lucide-react-native";

export default function GuestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const selectedPropertyId = useAuthStore((s) => s.selectedPropertyId);
  const setSelectedPropertyId = useAuthStore((s) => s.setSelectedPropertyId);

  const [search, setSearch] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);

  const assignedPropId = user?.assigned_property_id;
  const isAssignedToSingleProperty = !!assignedPropId;
  const activePropertyId = isAssignedToSingleProperty
    ? assignedPropId
    : selectedPropertyId || "all";

  // 1. Fetch organization properties for property filter bar
  const { data: propsData, refetch: refetchProps } = useQuery({
    queryKey: ["properties", user?.id],
    queryFn: async () => {
      const res = await api.get("/properties");
      return res.data?.data || [];
    },
    enabled: !!user,
  });

  const properties: any[] = Array.isArray(propsData) ? propsData : [];

  // 2. Fetch guests list with optional property scoping and search query
  const {
    data,
    isLoading,
    isError,
    error,
    refetch: refetchGuests,
    isRefetching,
  } = useQuery({
    queryKey: ["guests", search, activePropertyId],
    queryFn: async () => {
      const params: any = {
        search: search.trim() || undefined,
      };
      if (activePropertyId && activePropertyId !== "all") {
        params.property_id = activePropertyId;
      }
      const res = await api.get("/guests", { params });
      return res.data?.data || [];
    },
    enabled: !!user,
  });

  const onRefreshAll = async () => {
    await Promise.all([refetchGuests(), refetchProps()]);
  };

  const guests: any[] = Array.isArray(data) ? data : [];

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`).catch(() => {});
  };

  const handleEmail = (email?: string) => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  const renderGuest = ({ item }: { item: any }) => {
    const initial = (item.full_name || "G").charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedGuest(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {item.full_name}
            </Text>
            {item.blacklisted ? (
              <View style={styles.badgeBlacklist}>
                <ShieldAlert size={10} color="#b91c1c" />
                <Text style={styles.badgeTextBlacklist}>Blacklisted</Text>
              </View>
            ) : item.created_at ? (
              <Text style={styles.memberSince}>
                Guest since {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.details}>
          {item.phone && (
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => handleCall(item.phone)}
              activeOpacity={0.7}
            >
              <Phone size={13} color="#2563eb" />
              <Text style={[styles.detailText, { color: "#2563eb", fontWeight: "500" }]}>
                {item.phone}
              </Text>
            </TouchableOpacity>
          )}
          {item.email && (
            <View style={styles.detailRow}>
              <Mail size={13} color="#64748b" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
          )}
          {item.address && (
            <View style={styles.detailRow}>
              <MapPin size={13} color="#64748b" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Top Bar with Title & New Guest Action ──────────────────────────── */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>Guest Directory</Text>
          <Text style={styles.topBarSub}>
            {guests.length} {guests.length === 1 ? "guest" : "guests"} registered
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newGuestBtn}
          onPress={() => router.push("/new-guest" as any)}
          activeOpacity={0.8}
        >
          <UserPlus size={15} color="#ffffff" />
          <Text style={styles.newGuestBtnText}>+ Register</Text>
        </TouchableOpacity>
      </View>

      {/* ── Property Switcher Chips (For Owners & Multi-Property Staff) ───── */}
      {!isAssignedToSingleProperty && properties.length > 1 && (
        <View style={styles.propertyChipContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.propertyChipScroll}
          >
            <TouchableOpacity
              onPress={() => setSelectedPropertyId("all")}
              style={[
                styles.propertyChip,
                activePropertyId === "all" && styles.propertyChipActive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.propertyChipText,
                  activePropertyId === "all" && styles.propertyChipTextActive,
                ]}
              >
                🌐 All Properties ({guests.length})
              </Text>
            </TouchableOpacity>

            {properties.map((p: any) => {
              const isSelected = activePropertyId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPropertyId(p.id)}
                  style={[
                    styles.propertyChip,
                    isSelected && styles.propertyChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Building2
                    size={12}
                    color={isSelected ? "#ffffff" : "#64748b"}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.propertyChipText,
                      isSelected && styles.propertyChipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Search Input ───────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone or email..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} style={{ padding: 4 }}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Guest List with Native Pull to Refresh ─────────────────────────── */}
      {isLoading && !isRefetching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading guest profiles...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Unable to load guests</Text>
          <Text style={styles.emptySubtitle}>
            {(error as any)?.response?.data?.detail?.message ||
              (error as any)?.message ||
              "Failed to connect to the server."}
          </Text>
          <TouchableOpacity onPress={onRefreshAll} style={styles.retryBtn} activeOpacity={0.8}>
            <RefreshCw size={14} color="#2563eb" />
            <Text style={styles.retryBtnText}>Tap to Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={guests}
          keyExtractor={(item) => item.id}
          renderItem={renderGuest}
          contentContainerStyle={[
            styles.list,
            guests.length === 0 && { flexGrow: 1, justifyContent: "center" },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefreshAll}
              tintColor="#2563eb"
              colors={["#2563eb"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <User size={38} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No guests found</Text>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? `No guests matching "${search}".`
                  : activePropertyId !== "all"
                  ? "No guests with stays or bookings recorded for this property yet."
                  : "No guests registered yet in the system."}
              </Text>
              <TouchableOpacity onPress={onRefreshAll} style={styles.retryBtn} activeOpacity={0.8}>
                <RefreshCw size={14} color="#2563eb" />
                <Text style={styles.retryBtnText}>Tap to Refresh</Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Guest Detail / Quick Action Modal ───────────────────────────────── */}
      {selectedGuest && (
        <Modal visible={!!selectedGuest} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {(selectedGuest.full_name || "G").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle} numberOfLines={1}>
                      {selectedGuest.full_name}
                    </Text>
                    <Text style={styles.modalSubTitle}>
                      {selectedGuest.preferred_language
                        ? `Language: ${selectedGuest.preferred_language} • `
                        : ""}
                      Guest Profile
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedGuest(null)} style={styles.modalClose}>
                  <X size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {selectedGuest.blacklisted && (
                  <View style={styles.blacklistAlert}>
                    <ShieldAlert size={16} color="#b91c1c" />
                    <Text style={styles.blacklistAlertText}>
                      Blacklisted Guest — Caution advised before confirming stays.
                    </Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <View style={styles.detailRowModal}>
                    <Phone size={14} color="#64748b" />
                    <Text style={styles.detailLabelModal}>Phone:</Text>
                    <Text style={styles.detailValModal}>{selectedGuest.phone || "Not provided"}</Text>
                  </View>

                  <View style={styles.detailRowModal}>
                    <Mail size={14} color="#64748b" />
                    <Text style={styles.detailLabelModal}>Email:</Text>
                    <Text style={styles.detailValModal}>{selectedGuest.email || "Not provided"}</Text>
                  </View>

                  {selectedGuest.address && (
                    <View style={styles.detailRowModal}>
                      <MapPin size={14} color="#64748b" />
                      <Text style={styles.detailLabelModal}>Address:</Text>
                      <Text style={styles.detailValModal}>{selectedGuest.address}</Text>
                    </View>
                  )}

                  {selectedGuest.date_of_birth && (
                    <View style={styles.detailRowModal}>
                      <Calendar size={14} color="#64748b" />
                      <Text style={styles.detailLabelModal}>Birthdate:</Text>
                      <Text style={styles.detailValModal}>{selectedGuest.date_of_birth}</Text>
                    </View>
                  )}

                  {selectedGuest.notes && (
                    <View style={{ marginTop: 8, padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 2 }}>
                        Notes / Preferences:
                      </Text>
                      <Text style={{ fontSize: 13, color: "#334155" }}>{selectedGuest.notes}</Text>
                    </View>
                  )}
                </View>

                {/* Quick actions inside modal */}
                <View style={styles.modalActions}>
                  {selectedGuest.phone && (
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => handleCall(selectedGuest.phone)}
                    >
                      <Phone size={16} color="#2563eb" />
                      <Text style={styles.modalActionText}>Call</Text>
                    </TouchableOpacity>
                  )}
                  {selectedGuest.email && (
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => handleEmail(selectedGuest.email)}
                    >
                      <Mail size={16} color="#2563eb" />
                      <Text style={styles.modalActionText}>Email</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: "#2563eb", borderColor: "#2563eb" }]}
                    onPress={() => {
                      setSelectedGuest(null);
                      router.push("/new-reservation" as any);
                    }}
                  >
                    <Calendar size={16} color="#ffffff" />
                    <Text style={[styles.modalActionText, { color: "#ffffff" }]}>Book Room</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { fontSize: 13, color: "#64748b", marginTop: 10, fontWeight: "500" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  topBarTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  topBarSub: { fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: "500" },

  newGuestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  newGuestBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  propertyChipContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 8,
  },
  propertyChipScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  propertyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  propertyChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  propertyChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  propertyChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },

  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#0f172a" },

  list: { padding: 14, gap: 10, paddingBottom: 32 },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#2563eb" },
  name: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  memberSince: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  badgeBlacklist: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef2f2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 3,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  badgeTextBlacklist: { fontSize: 9.5, color: "#b91c1c", fontWeight: "700", textTransform: "uppercase" },

  details: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 13, color: "#475569" },

  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptyText: { color: "#94a3b8", fontSize: 13, textAlign: "center" },

  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptySubtitle: { fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4 },

  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  retryBtnText: { fontSize: 13, fontWeight: "600", color: "#2563eb" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  modalAvatarText: { fontSize: 18, fontWeight: "800", color: "#2563eb" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  modalSubTitle: { fontSize: 11, color: "#64748b", marginTop: 2 },
  modalClose: { padding: 4 },

  blacklistAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 12,
  },
  blacklistAlertText: { fontSize: 11, color: "#b91c1c", fontWeight: "600", flex: 1 },

  detailSection: { gap: 10, marginBottom: 16 },
  detailRowModal: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailLabelModal: { fontSize: 12, fontWeight: "600", color: "#64748b", width: 65 },
  detailValModal: { fontSize: 13, color: "#0f172a", fontWeight: "500", flex: 1 },

  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  modalActionText: { fontSize: 12, fontWeight: "700", color: "#2563eb" },
});
