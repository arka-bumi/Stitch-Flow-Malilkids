import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator, Image } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api, getStoredUser } from "@/src/api/client";

const EMPTY_IMG = "https://images.pexels.com/photos/3945359/pexels-photo-3945359.jpeg";

function toMin(t?: string) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtMin(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}j ${mm}m` : `${mm}m`;
}

export default function Beranda() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const u = await getStoredUser();
      setUser(u);
      const p = (n: number) => (n < 10 ? "0" + n : "" + n);
      const d = new Date();
      const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const data = await api.entriesToday(today);
      setEntries(data || []);
    } catch (e) {
      setEntries([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const totalUtama = entries.reduce((a, e) => a + Math.max(0, toMin(e.waktu_selesai) - toMin(e.waktu_mulai)), 0);
  const totalOutput = entries.reduce((a, e) => a + (e.jumlah_per_aktivitas || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Halo,</Text>
          <Text style={styles.name}>{user?.nama || "Penjahit"}</Text>
          <Text style={styles.team}>Tim {user?.tim}</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="calendar" size={14} color={colors.brandPrimary} />
          <Text style={styles.badgeText}>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="time" size={22} color={colors.brandPrimary} />
            <Text style={styles.statValue}>{fmtMin(totalUtama)}</Text>
            <Text style={styles.statLabel}>Total Waktu Kerja</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cube" size={22} color={colors.brandSecondary} />
            <Text style={styles.statValue}>{totalOutput}</Text>
            <Text style={styles.statLabel}>Total Output</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Input Baru</Text>

        <Pressable style={[styles.actionCard, { backgroundColor: colors.brandPrimary }]} onPress={() => router.push("/form-utama")} testID="btn-form-utama">
          <View style={styles.actionIcon}>
            <Ionicons name="hammer" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Input Aktivitas Utama</Text>
            <Text style={styles.actionSub}>Memotong, menjahit, mengobras, dll</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#fff" />
        </Pressable>

        <Pressable style={[styles.actionCard, { backgroundColor: colors.brandSecondary }]} onPress={() => router.push("/form-lain")} testID="btn-form-lain">
          <View style={styles.actionIcon}>
            <Ionicons name="cafe" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Input Aktivitas Lain</Text>
            <Text style={styles.actionSub}>Sholat, makan, ke toilet, dll</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#fff" />
        </Pressable>

        <Text style={styles.sectionTitle}>Entri Hari Ini ({entries.length})</Text>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
        ) : entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImg} />
            <Text style={styles.emptyText}>Belum ada aktivitas hari ini.</Text>
            <Text style={styles.emptySub}>Tekan tombol di atas untuk mulai mencatat.</Text>
          </View>
        ) : (
          entries.map((e) => <EntryCard key={e.id} entry={e} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EntryCard({ entry }: { entry: any }) {
  return (
    <View style={styles.entryCard} testID={`entry-${entry.id}`}>
      <View style={styles.entryHeader}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{entry.kode_produksi}</Text>
        </View>
        <View style={styles.pillOutline}>
          <Text style={styles.pillOutlineText}>{entry.jenis_produk} · {entry.motif}</Text>
        </View>
        {entry.synced_to_sheet && (
          <Ionicons name="cloud-done" size={18} color={colors.success} style={{ marginLeft: "auto" }} />
        )}
      </View>
      {entry.aktivitas_utama && (
        <View style={styles.row}>
          <Ionicons name="hammer-outline" size={16} color={colors.brandPrimary} />
          <Text style={styles.rowLabel}>{entry.aktivitas_utama}</Text>
          <Text style={styles.rowTime}>{entry.waktu_mulai} - {entry.waktu_selesai}</Text>
        </View>
      )}
      {(entry.jumlah_per_batch || entry.jumlah_per_aktivitas) && (
        <View style={styles.row}>
          <Ionicons name="cube-outline" size={16} color={colors.muted} />
          <Text style={styles.rowMuted}>
            Batch: {entry.jumlah_per_batch ?? "-"} · Selesai: {entry.jumlah_per_aktivitas ?? "-"}
          </Text>
        </View>
      )}
      {entry.aktivitas_lain && (
        <View style={styles.row}>
          <Ionicons name="cafe-outline" size={16} color={colors.brandSecondary} />
          <Text style={styles.rowLabel}>{entry.aktivitas_lain}</Text>
          <Text style={styles.rowTime}>{entry.waktu_mulai_lain} - {entry.waktu_selesai_lain}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  hello: { color: colors.muted, fontSize: 13 },
  name: { fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  team: { fontSize: 12, color: colors.brandPrimary, fontWeight: "600", marginTop: 2 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill,
  },
  badgeText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg,
    gap: 6, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontSize: 12, color: colors.muted },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.md, textTransform: "uppercase", letterSpacing: 0.5 },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md,
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  actionTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  actionSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  emptyWrap: { alignItems: "center", padding: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  emptyImg: { width: 120, height: 120, borderRadius: 12, marginBottom: spacing.md },
  emptyText: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  emptySub: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center" },
  entryCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  pill: { backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  pillOutline: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillOutlineText: { color: colors.onSurface, fontSize: 11, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  rowLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
  rowTime: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  rowMuted: { color: colors.muted, fontSize: 12 },
});
