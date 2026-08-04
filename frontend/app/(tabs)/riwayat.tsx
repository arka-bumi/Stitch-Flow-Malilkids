import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

export default function Riwayat() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const data = await api.entriesAll();
      setEntries(data || []);
    } catch (e) {
      setEntries([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const remove = (id: string) => {
    Alert.alert("Hapus Entri?", "Entri akan dihapus permanen.", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        try { await api.deleteEntry(id); toast.show("Entri dihapus", "success"); load(); }
        catch (e: any) { toast.show(e.message, "error"); }
      }},
    ]);
  };

  const grouped = entries.reduce<Record<string, any[]>>((acc, e) => {
    (acc[e.tanggal] = acc[e.tanggal] || []).push(e);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat Entri</Text>
        <Text style={styles.subtitle}>{entries.length} entri total</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          {Object.keys(grouped).length === 0 && <Text style={styles.empty}>Belum ada riwayat.</Text>}
          {Object.entries(grouped).map(([tanggal, items]) => (
            <View key={tanggal} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.dateHeader}>{tanggal}</Text>
              {items.map((e) => (
                <View key={e.id} style={styles.card} testID={`riwayat-${e.id}`}>
                  <View style={styles.cardHead}>
                    <Text style={styles.kode}>{e.kode_produksi}</Text>
                    <Pressable onPress={() => remove(e.id)} testID={`del-${e.id}`} hitSlop={10}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                  <Text style={styles.produk}>{e.jenis_produk} · {e.motif}</Text>
                  {e.aktivitas_utama && (
                    <Text style={styles.line}>
                      <Ionicons name="hammer" size={12} color={colors.brandPrimary} /> {e.aktivitas_utama} · {e.waktu_mulai}-{e.waktu_selesai}
                    </Text>
                  )}
                  {e.aktivitas_lain && (
                    <Text style={styles.line}>
                      <Ionicons name="cafe" size={12} color={colors.brandSecondary} /> {e.aktivitas_lain} · {e.waktu_mulai_lain}-{e.waktu_selesai_lain}
                    </Text>
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
  subtitle: { color: colors.muted, marginTop: 4 },
  empty: { textAlign: "center", padding: spacing.xl, color: colors.muted },
  dateHeader: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: spacing.sm, textTransform: "uppercase" },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kode: { fontWeight: "700", color: colors.brandPrimary },
  produk: { color: colors.onSurface, marginTop: 2, fontSize: 13 },
  line: { color: colors.onSurface, fontSize: 13, marginTop: 4 },
});
