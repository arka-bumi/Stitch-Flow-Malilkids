import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

export default function PenjahitMgmt() {
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [nama, setNama] = useState("");
  const [pin, setPin] = useState("");
  const [tim, setTim] = useState("");

  const load = async () => {
    try { setList(await api.listPenjahit()); }
    catch (e: any) { toast.show(e.message, "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!nama.trim() || !pin.trim() || !tim.trim()) return toast.show("Isi semua field", "error");
    try {
      await api.createPenjahit(nama.trim(), pin, tim.trim());
      toast.show("Penjahit ditambahkan", "success");
      setNama(""); setPin(""); setTim(""); setShowAdd(false);
      load();
    } catch (e: any) { toast.show(e.message, "error"); }
  };

  const toggleActive = async (p: any) => {
    try { await api.updatePenjahit(p.id, { active: !p.active }); load(); }
    catch (e: any) { toast.show(e.message, "error"); }
  };

  const resetPin = (p: any) => {
    Alert.prompt?.("Reset PIN", `PIN baru untuk ${p.nama} (4-6 digit):`, async (v?: string) => {
      if (!v) return;
      try { await api.updatePenjahit(p.id, { pin: v }); toast.show("PIN diperbarui", "success"); }
      catch (e: any) { toast.show(e.message, "error"); }
    });
  };

  const del = (p: any) => {
    Alert.alert("Hapus penjahit?", p.nama, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        try { await api.deletePenjahit(p.id); toast.show("Terhapus", "success"); load(); }
        catch (e: any) { toast.show(e.message, "error"); }
      } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="btn-back"><Ionicons name="arrow-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Daftar Penjahit</Text>
        <Pressable onPress={() => setShowAdd(!showAdd)} testID="btn-add"><Ionicons name={showAdd ? "close" : "add"} size={26} color={colors.brandPrimary} /></Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {showAdd && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Tambah Penjahit</Text>
              <TextInput style={styles.input} placeholder="Nama" placeholderTextColor={colors.muted} value={nama} onChangeText={setNama} autoCapitalize="words" testID="add-nama" />
              <TextInput style={styles.input} placeholder="PIN (4-6 digit)" placeholderTextColor={colors.muted} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" secureTextEntry testID="add-pin" />
              <TextInput style={styles.input} placeholder="Tim (contoh: A)" placeholderTextColor={colors.muted} value={tim} onChangeText={setTim} autoCapitalize="characters" testID="add-tim" />
              <Pressable style={styles.saveBtn} onPress={add} testID="btn-save-penjahit">
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveText}>Simpan</Text>
              </Pressable>
            </View>
          )}

          {loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : list.length === 0 ? (
            <Text style={styles.empty}>Belum ada penjahit</Text>
          ) : list.map((p) => (
            <View key={p.id} style={[styles.card, !p.active && styles.cardInactive]} testID={`penjahit-${p.id}`}>
              <View style={styles.cardHead}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{p.nama.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{p.nama}</Text>
                  <Text style={styles.cardMeta}>Tim {p.tim} · {p.active !== false ? "Aktif" : "Nonaktif"}</Text>
                </View>
                <Switch value={p.active !== false} onValueChange={() => toggleActive(p)} trackColor={{ true: colors.brandPrimary, false: colors.border }} testID={`toggle-${p.id}`} />
              </View>
              <View style={styles.actions}>
                <Pressable style={[styles.actBtn, { backgroundColor: colors.info }]} onPress={() => resetPin(p)} testID={`reset-pin-${p.id}`}>
                  <Ionicons name="key" size={14} color="#fff" />
                  <Text style={styles.actText}>Reset PIN</Text>
                </Pressable>
                <Pressable style={[styles.actBtn, { backgroundColor: colors.error }]} onPress={() => del(p)} testID={`del-penjahit-${p.id}`}>
                  <Ionicons name="trash" size={14} color="#fff" />
                  <Text style={styles.actText}>Hapus</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.brandPrimary },
  formTitle: { fontSize: 14, fontWeight: "700", color: colors.brandPrimary, marginBottom: spacing.md, textTransform: "uppercase" },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15, color: colors.onSurface, marginBottom: spacing.sm, backgroundColor: colors.surface },
  saveBtn: { height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  saveText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardInactive: { opacity: 0.5 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brandPrimary, fontWeight: "800" },
  cardName: { fontWeight: "700", color: colors.onSurface, fontSize: 15 },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: radius.md },
  actText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", color: colors.muted, padding: spacing.xl },
});
