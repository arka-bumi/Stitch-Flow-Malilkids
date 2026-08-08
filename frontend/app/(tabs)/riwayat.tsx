import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/api/client";

export default function Riwayat() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setRecords((await api.listRecords()) || []); }
    catch { setRecords([]); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const grouped = records.reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.tanggal] = acc[r.tanggal] || []).push(r);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat</Text>
        <Text style={styles.subtitle}>{records.length} record · Auto-purge 12 jam setelah sync</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          {Object.keys(grouped).length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="archive" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>Belum ada riwayat</Text>
            </View>
          )}
          {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([tanggal, items]) => (
            <View key={tanggal} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.dateHeader}>{tanggal}</Text>
              {items.map((r) => (
                <View key={r.id} style={styles.card} testID={`hist-${r.id}`}>
                  <View style={styles.cardHead}>
                    <View style={styles.pill}><Text style={styles.pillText}>{r.waktu_mulai} - {r.waktu_selesai}</Text></View>
                    {r.is_synced ? <Ionicons name="cloud-done" size={16} color={colors.success} /> : <Ionicons name="ellipse-outline" size={14} color={colors.muted} />}
                  </View>
                  <Text style={styles.kode}>{r.aktivitas_utama || r.aktivitas_lain_list?.[0]?.nama}</Text>
                  <Text style={styles.meta}>{r.kode_produksi} · {r.jenis_produk} · {r.motif}</Text>
                  {(r.aktivitas_lain_list || []).length > 0 && (
                    <Text style={styles.lain}>+ {r.aktivitas_lain_list.length} aktivitas lain</Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: 4, fontSize: 12 },
  empty: { alignItems: "center", padding: spacing["2xl"] },
  emptyText: { color: colors.muted, marginTop: spacing.sm },
  dateHeader: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: spacing.sm, textTransform: "uppercase" },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  kode: { fontWeight: "700", color: colors.onSurface, marginTop: 6 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lain: { color: colors.brandSecondary, fontSize: 12, marginTop: 4, fontWeight: "600" },
});
