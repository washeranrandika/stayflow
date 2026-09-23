import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Phone, Mail, MapPin } from "lucide-react-native";

export default function GuestsScreen() {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["guests", search],
    queryFn: async () => {
      const res = await api.get("/guests", { params: { search: search || undefined } });
      return res.data.data;
    },
  });

  const guests = data || [];

  const renderGuest = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.full_name}</Text>
          {item.blacklisted && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Blacklisted</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.details}>
        {item.phone && (
          <View style={styles.detailRow}>
            <Phone size={14} color="#64748b" />
            <Text style={styles.detailText}>{item.phone}</Text>
          </View>
        )}
        {item.email && (
          <View style={styles.detailRow}>
            <Mail size={14} color="#64748b" />
            <Text style={styles.detailText}>{item.email}</Text>
          </View>
        )}
        {item.address && (
          <View style={styles.detailRow}>
            <MapPin size={14} color="#64748b" />
            <Text style={styles.detailText}>{item.address}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search guests by name, phone or email..."
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={guests}
          keyExtractor={(item) => item.id}
          renderItem={renderGuest}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No guests found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchContainer: { padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  searchBox: { 
    flexDirection: "row", alignItems: "center", backgroundColor: "#f1f5f9",
    borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: "#0f172a" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#e0e7ff",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#4338ca" },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  badge: { 
    backgroundColor: "#fef2f2", paddingHorizontal: 6, paddingVertical: 2, 
    borderRadius: 4, alignSelf: "flex-start", marginTop: 4, borderWidth: 1, borderColor: "#fecaca" 
  },
  badgeText: { fontSize: 10, color: "#b91c1c", fontWeight: "700", textTransform: "uppercase" },
  details: { gap: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 14, color: "#475569" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#94a3b8" },
});
