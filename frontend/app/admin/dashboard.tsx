import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl, TextInput, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api, clearAuth } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { todayISO, fmtMin } from "@/src/utils/shift";

export default function AdminDashboard() {
  const router = useRouter();
  const toast = useToast();
  const [tanggal, setTanggal] = useState(todayISO());
  const [tim, setTim] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingMaster, setSyncingMaster] = useState(false);

  const load = async () => {
    try {
      const [s, e] = await Promise.all([api.adminSummary(tanggal), api.adminRecords({ tanggal, tim: tim || undefined })]);
      setSummary(s); setRecords(e || []);
    } catch (err: any) { toast.show(err.message || "Gagal memuat", "error"); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [tanggal, tim]));

  const logout = async () => { await clearAuth(); router.replace("/"); };

  const syncRecords = () => {
    Alert.alert("Sinkron ke Google Sheet?", "Semua record yang belum sync akan didorong ke Sheet. Setelah sync, record hanya di-purge dari app setelah 12 jam.", [
      { text: "Batal", style: "cancel" },
      { text: "Sinkron", onPress: async () => {
        setSyncing(true);
        try { const r = await api.syncRecords(); toast.show(`Sync: ${r.synced} berhasil, ${r.failed} gagal`, r.failed ? "error" : "success"); load(); }
        catch (e: any) { toast.show(e.message, "error"); }
        finally { setSyncing(false); }
      } },
    ]);
  };

  const syncMaster = async () => {
    setSyncingMaster(true);
    try {
      const r = await api.syncMaster();
      toast.show(`Master data di-sync: ${r.kode_produksi_count} kode, ${r.tahapan_count} tahapan`, "success");
    } catch (e: any) { toast.show(e.message, "error"); }
    finally { setSyncingMaster(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Rekap performa penjahit</Text>
        </View>
        <Pressable onPress={logout} style={styles.iconBtn} testID="btn-admin-logout">
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navRow} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <NavChip icon="people" label="Penjahit" onPress={() => router.push("/admin/penjahit-mgmt")} testID="nav-penjahit" />
        <NavChip icon="shield" label="Admin" onPress={() => router.push("/admin/admin-mgmt")} testID="nav-admin" />
        <NavChip icon="cloud-download" label="Sync Master" onPress={syncMaster} loading={syncingMaster} testID="nav-sync-master" />
        <NavChip icon="settings" label="Settings" onPress={() => router.push("/admin/settings")} testID="nav-settings" />
      </ScrollView>

      <View style={styles.filterBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterLabel}>Tanggal</Text>
          <TextInput style={styles.filterInput} value={tanggal} onChangeText={setTanggal} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} testID="filter-tanggal" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterLabel}>Tim</Text>
          <TextInput style={styles.filterInput} value={tim} onChangeText={setTim} placeholder="Semua" placeholderTextColor={colors.muted} autoCapitalize="characters" testID="filter-tim" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : (
          <>
            <View style={styles.statsGrid}>
              <StatBox icon="documents" color={colors.brandPrimary} value={String(summary?.total_records || 0)} label="Records" />
              <StatBox icon="time" color={colors.brandPrimary} value={fmtMin(summary?.total_menit_utama || 0)} label="Menit Utama" />
              <StatBox icon="cafe" color={colors.brandSecondary} value={fmtMin(summary?.total_menit_lain || 0)} label="Menit Lain" />
              <StatBox icon="cube" color={colors.success} value={String(summary?.total_output || 0)} label="Output" />
            </View>

            <Text style={styles.section}>Per Penjahit</Text>
            {(summary?.per_penjahit || []).length === 0 ? <Text style={styles.empty}>Tidak ada data</Text> : (
              (summary.per_penjahit || []).map((p: any, i: number) => (
                <View key={i} style={styles.penjahitCard}>
                  <View style={styles.penjahitHead}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{(p.nama || "?").charAt(0).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.penjahitName}>{p.nama}</Text>
                      <Text style={styles.penjahitTim}>Tim {p.tim} · {p.records} record</Text>
                    </View>
                  </View>
                  <View style={styles.penjahitMetrics}>
                    <Metric label="Utama" value={fmtMin(p.menit_utama)} />
                    <Metric label="Lain" value={fmtMin(p.menit_lain)} />
                    <Metric label="Output" value={String(p.output)} />
                  </View>
                </View>
              ))
            )}

            <Text style={styles.section}>Semua Records ({records.length})</Text>
            {records.length === 0 ? <Text style={styles.empty}>Tidak ada records</Text> : records.map((r) => (
              <View key={r.id} style={styles.entry} testID={`admin-rec-${r.id}`}>
                <View style={styles.entryHead}>
                  <Text style={styles.entryNama}>{r.nama} · Tim {r.tim}</Text>
                  {r.is_synced && <Ionicons name="cloud-done" size={16} color={colors.success} />}
                </View>
                <Text style={styles.entryMeta}>{r.kode_produksi} · {r.jenis_produk} · {r.motif}{r.size ? ` · ${r.size}` : ""}</Text>
                <Text style={styles.entryLine}>{r.waktu_mulai}-{r.waktu_selesai} · {r.aktivitas_utama || r.aktivitas_lain_list?.[0]?.nama}</Text>
                {(r.aktivitas_lain_list || []).length > 0 && (
                  <Text style={[styles.entryLine, { color: colors.brandSecondary }]}>
                    {(r.aktivitas_lain_list || []).map((l: any) => `${l.nama} (${l.waktu_mulai}-${l.waktu_selesai})`).join(" · ")}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.fab}>
        <Pressable style={styles.fabBtn} onPress={syncRecords} disabled={syncing} testID="btn-sync">
          {syncing ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="cloud-upload" size={20} color="#fff" /><Text style={styles.fabText}>Sync Records ke Google Sheet</Text></>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function NavChip({ icon, label, onPress, loading, testID }: any) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={styles.chip} testID={testID}>
      {loading ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : <Ionicons name={icon} size={16} color={colors.brandPrimary} />}
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}
function StatBox({ icon, color, value, label }: any) {
  return (
    <View style={statStyles.box}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}
function Metric({ label, value }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onSurface }}>{value}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  box: { flex: 1, minWidth: "45%", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.border },
  value: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  label: { fontSize: 11, color: colors.muted },
});
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: 2, fontSize: 12 },
  iconBtn: { padding: 8 },
  navRow: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider, maxHeight: 56, paddingVertical: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, flexShrink: 0 },
  chipText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
  filterBar: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  filterLabel: { fontSize: 11, color: colors.muted, marginBottom: 4, fontWeight: "600" },
  filterInput: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 14, color: colors.onSurface, backgroundColor: colors.surface },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  section: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  penjahitCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  penjahitHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brandPrimary, fontWeight: "800" },
  penjahitName: { fontWeight: "700", color: colors.onSurface },
  penjahitTim: { color: colors.muted, fontSize: 12 },
  penjahitMetrics: { flexDirection: "row", gap: spacing.sm },
  empty: { textAlign: "center", color: colors.muted, padding: spacing.lg },
  entry: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  entryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryNama: { fontWeight: "700", color: colors.onSurface },
  entryMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  entryLine: { color: colors.onSurface, fontSize: 13, marginTop: 4 },
  fab: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  fabBtn: { height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
