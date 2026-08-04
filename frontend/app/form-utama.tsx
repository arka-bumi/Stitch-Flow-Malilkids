import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { Dropdown } from "@/src/components/Dropdown";
import { TimeField } from "@/src/components/TimeField";
import { DateField } from "@/src/components/DateField";

function todayISO() {
  const d = new Date();
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function FormUtama() {
  const router = useRouter();
  const toast = useToast();

  const [master, setMaster] = useState<any>({ jenis_produk: [], motif: [], aktivitas_utama: [], aktivitas_lain: [], tim: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [kodeProduksi, setKodeProduksi] = useState("");
  const [tanggal, setTanggal] = useState(todayISO());
  const [jenisProduk, setJenisProduk] = useState("");
  const [motif, setMotif] = useState("");
  const [aktivitasUtama, setAktivitasUtama] = useState("");
  const [jumlahBatch, setJumlahBatch] = useState("");
  const [jumlahAktivitas, setJumlahAktivitas] = useState("");
  const [waktuMulai, setWaktuMulai] = useState("");
  const [waktuSelesai, setWaktuSelesai] = useState("");

  const [includeLain, setIncludeLain] = useState(false);
  const [aktivitasLain, setAktivitasLain] = useState("");
  const [waktuMulaiLain, setWaktuMulaiLain] = useState("");
  const [waktuSelesaiLain, setWaktuSelesaiLain] = useState("");

  useEffect(() => {
    api.getMaster().then((m) => { setMaster(m); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const addMaster = async (type: string, value: string) => {
    try {
      await api.addMaster(type, value);
      const m = await api.getMaster();
      setMaster(m);
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  const submit = async () => {
    if (!kodeProduksi.trim()) return toast.show("Isi Kode Produksi", "error");
    if (!jenisProduk || !motif) return toast.show("Lengkapi Jenis Produk & Motif", "error");
    if (!aktivitasUtama) return toast.show("Pilih Aktivitas Utama", "error");
    if (!waktuMulai || !waktuSelesai) return toast.show("Lengkapi Waktu Mulai/Selesai", "error");
    if (includeLain && (!aktivitasLain || !waktuMulaiLain || !waktuSelesaiLain)) {
      return toast.show("Lengkapi data Aktivitas Lain", "error");
    }
    setSubmitting(true);
    try {
      await api.createEntry({
        kode_produksi: kodeProduksi.trim(),
        tanggal,
        jenis_produk: jenisProduk,
        motif,
        aktivitas_utama: aktivitasUtama,
        jumlah_per_batch: jumlahBatch ? parseInt(jumlahBatch) : null,
        jumlah_per_aktivitas: jumlahAktivitas ? parseInt(jumlahAktivitas) : null,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        aktivitas_lain: includeLain ? aktivitasLain : null,
        waktu_mulai_lain: includeLain ? waktuMulaiLain : null,
        waktu_selesai_lain: includeLain ? waktuSelesaiLain : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Entri tersimpan", "success");
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show(e.message || "Gagal menyimpan", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="btn-back"><Ionicons name="arrow-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Input Aktivitas Utama</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.section}>Data Produk</Text>
            <Text style={styles.label}>Kode Produksi *</Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: x100"
              placeholderTextColor={colors.muted}
              value={kodeProduksi}
              onChangeText={setKodeProduksi}
              testID="input-kode"
            />
            <DateField label="Tanggal" value={tanggal} onChange={setTanggal} testID="input-tanggal" />
            <Dropdown label="Jenis Produk" required value={jenisProduk} options={master.jenis_produk} onChange={setJenisProduk} onAddNew={(v) => addMaster("jenis_produk", v)} testID="dd-jenis" />
            <Dropdown label="Motif" required value={motif} options={master.motif} onChange={setMotif} onAddNew={(v) => addMaster("motif", v)} testID="dd-motif" />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Aktivitas Utama</Text>
            <Dropdown label="Aktivitas Utama" required value={aktivitasUtama} options={master.aktivitas_utama} onChange={setAktivitasUtama} onAddNew={(v) => addMaster("aktivitas_utama", v)} testID="dd-aktivitas" />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Jumlah Per Batch</Text>
                <TextInput style={styles.input} placeholder="Ex: 10" placeholderTextColor={colors.muted} keyboardType="numeric" value={jumlahBatch} onChangeText={setJumlahBatch} testID="input-batch" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Jumlah Selesai</Text>
                <TextInput style={styles.input} placeholder="Ex: 10" placeholderTextColor={colors.muted} keyboardType="numeric" value={jumlahAktivitas} onChangeText={setJumlahAktivitas} testID="input-jumlah" />
              </View>
            </View>
            <View style={styles.row2}>
              <TimeField label="Waktu Mulai" required value={waktuMulai} onChange={setWaktuMulai} testID="time-mulai" />
              <TimeField label="Waktu Selesai" required value={waktuSelesai} onChange={setWaktuSelesai} testID="time-selesai" />
            </View>
          </View>

          <Pressable
            style={[styles.toggle, includeLain && styles.toggleActive]}
            onPress={() => setIncludeLain(!includeLain)}
            testID="toggle-lain"
          >
            <Ionicons name={includeLain ? "remove-circle" : "add-circle"} size={22} color={includeLain ? colors.error : colors.brandPrimary} />
            <Text style={styles.toggleText}>
              {includeLain ? "Hapus Aktivitas Lain" : "Tambah Aktivitas Lain di waktu ini"}
            </Text>
          </Pressable>

          {includeLain && (
            <View style={[styles.card, { borderColor: colors.brandSecondary }]}>
              <Text style={styles.section}>Aktivitas Lain (Berbarengan)</Text>
              <Dropdown label="Aktivitas Lain" required value={aktivitasLain} options={master.aktivitas_lain} onChange={setAktivitasLain} onAddNew={(v) => addMaster("aktivitas_lain", v)} testID="dd-lain" />
              <View style={styles.row2}>
                <TimeField label="Mulai" required value={waktuMulaiLain} onChange={setWaktuMulaiLain} testID="time-mulai-lain" />
                <TimeField label="Selesai" required value={waktuSelesaiLain} onChange={setWaktuSelesaiLain} testID="time-selesai-lain" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.stickyBar}>
          <Pressable style={styles.saveBtn} onPress={submit} disabled={submitting} testID="btn-save">
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveText}>Simpan Entri</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  section: { fontSize: 12, fontWeight: "700", color: colors.brandPrimary, marginBottom: spacing.md, textTransform: "uppercase", letterSpacing: 0.5 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface, marginBottom: spacing.md, backgroundColor: colors.surface },
  row2: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  toggle: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.brandPrimary, borderRadius: radius.md,
    borderStyle: "dashed", marginBottom: spacing.lg,
  },
  toggleActive: { borderColor: colors.error, borderStyle: "solid" },
  toggleText: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: spacing.lg, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.divider,
  },
  saveBtn: { height: 56, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
