import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { Dropdown } from "@/src/components/Dropdown";
import { TimeField } from "@/src/components/TimeField";
import { todayISO, toMin } from "@/src/utils/shift";
import { storage } from "@/src/utils/storage";

const LAINNYA = "Lainnya:";
const LAST_KODE_KEY = "last_kode_produksi";

export default function FormLain() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ suggest_start?: string; edit_id?: string }>();
  const editMode = !!params.edit_id;

  const [master, setMaster] = useState<any>({ kode_produksi: [], aktivitas_lain: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastKode, setLastKode] = useState("");
  const [recordType, setRecordType] = useState<"lain_saja" | "istirahat">("lain_saja");

  const [kodeProduksi, setKodeProduksi] = useState("");
  const [jenisProduk, setJenisProduk] = useState("");
  const [motif, setMotif] = useState("");
  const [size, setSize] = useState("");
  const [aktivitasLain, setAktivitasLain] = useState("");
  const [customLain, setCustomLain] = useState("");
  const [waktuMulai, setWaktuMulai] = useState(params.suggest_start || "");
  const [waktuSelesai, setWaktuSelesai] = useState("");

  const kodeOptions = useMemo(() => master.kode_produksi.map((k: any) => k.kode).filter(Boolean), [master.kode_produksi]);
  const lainOptions = useMemo(() => [...(master.aktivitas_lain || []), LAINNYA], [master.aktivitas_lain]);
  const isCustom = aktivitasLain === LAINNYA;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [m, savedKode, todays] = await Promise.all([
            api.getMaster(),
            storage.getItem(LAST_KODE_KEY, ""),
            editMode ? api.listRecords(todayISO()) : Promise.resolve([]),
          ]);
          if (!active) return;
          setMaster(m);
          setLastKode(savedKode || "");
          if (editMode && params.edit_id) {
            const found = (todays || []).find((r: any) => r.id === params.edit_id);
            if (found) {
              setRecordType(found.type === "istirahat" ? "istirahat" : "lain_saja");
              setKodeProduksi(found.kode_produksi);
              setJenisProduk(found.jenis_produk);
              setMotif(found.motif);
              setSize(found.size || "");
              const namaLain = found.aktivitas_lain_list?.[0]?.nama || "";
              const opts: string[] = m.aktivitas_lain || [];
              if (namaLain && !opts.includes(namaLain)) {
                setAktivitasLain(LAINNYA);
                setCustomLain(namaLain);
              } else {
                setAktivitasLain(namaLain);
              }
              setWaktuMulai(found.waktu_mulai);
              setWaktuSelesai(found.waktu_selesai);
            }
          }
        } catch (e: any) { toast.show(e.message || "Gagal memuat", "error"); }
        finally { if (active) setLoading(false); }
      })();
      return () => { active = false; };
    }, [params.edit_id])
  );

  const onSelectKode = (kode: string) => {
    setKodeProduksi(kode);
    const found = master.kode_produksi.find((k: any) => k.kode === kode);
    if (found) {
      setJenisProduk(found.jenis_produk || "");
      setMotif(found.motif || "");
      setSize(found.size || "");
    }
  };

  const submit = async () => {
    if (!kodeProduksi) return toast.show("Pilih Kode Produksi", "error");
    if (!jenisProduk || !motif) return toast.show("Jenis Produk & Motif harus terisi", "error");
    const finalNama = isCustom ? customLain.trim() : aktivitasLain;
    if (!finalNama) return toast.show(isCustom ? "Isi nama aktivitas kustom" : "Pilih Aktivitas Lain", "error");
    if (!waktuMulai || !waktuSelesai) return toast.show("Isi Waktu Mulai/Selesai", "error");
    if ((toMin(waktuSelesai) || 0) <= (toMin(waktuMulai) || 0)) return toast.show("Waktu Selesai harus > Mulai", "error");

    setSubmitting(true);
    try {
      const payload = {
        tanggal: todayISO(),
        kode_produksi: kodeProduksi,
        jenis_produk: jenisProduk,
        motif,
        size: size || null,
        mode: "reguler",
        type: recordType,
        aktivitas_utama: null,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        aktivitas_lain_list: [{ nama: finalNama, waktu_mulai: waktuMulai, waktu_selesai: waktuSelesai }],
      };
      if (editMode && params.edit_id) {
        await api.updateRecord(params.edit_id, payload);
      } else {
        await api.createRecord(payload);
      }
      await storage.setItem(LAST_KODE_KEY, kodeProduksi);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Tersimpan", "success");
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show(e.message || "Gagal menyimpan", "error");
    } finally { setSubmitting(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="btn-back"><Ionicons name="arrow-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>{editMode ? (recordType === "istirahat" ? "Edit Istirahat" : "Edit Aktivitas Lain") : "Input Aktivitas Lain"}</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.section}>Konteks Produksi</Text>
            <Dropdown label="Kode Produksi" required value={kodeProduksi} options={kodeOptions} onChange={onSelectKode} testID="dd-kode" />
            {!!lastKode && lastKode !== kodeProduksi && (
              <Pressable style={styles.reuseRow} onPress={() => onSelectKode(lastKode)} testID="checkbox-reuse-kode">
                <Ionicons name="square-outline" size={18} color={colors.info} />
                <Text style={styles.reuseText}>Kode produksi sebelumnya: {lastKode}</Text>
              </Pressable>
            )}
            {kodeProduksi && (
              <View style={styles.autoFillBox}>
                <Ionicons name="information-circle" size={14} color={colors.info} />
                <Text style={styles.autoFillText}>Auto-fill: {jenisProduk || "-"} · {motif || "-"}{size ? ` · ${size}` : ""}</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Aktivitas Lain</Text>
            <Dropdown label="Jenis Aktivitas" required value={aktivitasLain}
              options={lainOptions} onChange={setAktivitasLain} testID="dd-lain" />
            {isCustom && (
              <>
                <Text style={styles.label}>Ketik Aktivitas Kustom *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Meeting, Rapat harian, dll"
                  placeholderTextColor={colors.muted}
                  value={customLain}
                  onChangeText={setCustomLain}
                  autoCapitalize="sentences"
                  testID="input-custom-lain"
                />
                <Text style={styles.hint}>Entri kustom tidak akan menambah dropdown master.</Text>
              </>
            )}
            <View style={styles.row2}>
              <TimeField label="Waktu Mulai" required value={waktuMulai} onChange={setWaktuMulai} testID="time-mulai" />
              <TimeField label="Waktu Selesai" required value={waktuSelesai} onChange={setWaktuSelesai} testID="time-selesai" />
            </View>
          </View>
        </ScrollView>
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Pressable style={styles.saveBtn} onPress={submit} disabled={submitting} testID="btn-save">
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <><Ionicons name="checkmark-circle" size={22} color="#fff" /><Text style={styles.saveText}>{editMode ? "Update" : "Simpan Aktivitas Lain"}</Text></>
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
  title: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  section: { fontSize: 12, fontWeight: "700", color: colors.info, marginBottom: spacing.md, textTransform: "uppercase", letterSpacing: 0.5 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.sm },
  hint: { fontSize: 11, color: colors.muted, fontStyle: "italic", marginTop: 4 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.info, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface, marginBottom: spacing.md, backgroundColor: colors.surface },
  row2: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  autoFillBox: { flexDirection: "row", alignItems: "center", gap: 4, padding: 8, backgroundColor: colors.brandTertiary, borderRadius: radius.sm, marginTop: 4 },
  autoFillText: { color: colors.info, fontSize: 12, fontWeight: "600", flex: 1 },
  reuseRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: spacing.xs },
  reuseText: { color: colors.info, fontSize: 12, fontWeight: "600", flex: 1 },
  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  saveBtn: { height: 56, borderRadius: radius.md, backgroundColor: colors.info, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

