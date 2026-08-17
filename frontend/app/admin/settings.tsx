import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

export default function AdminSettings() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [masterKodeTab, setMasterKodeTab] = useState("Kode Produksi");
  const [masterTahapanTab, setMasterTahapanTab] = useState("Tahapan Standar");
  const [masterLainTab, setMasterLainTab] = useState("Aktivitas Lain");
  const [saJson, setSaJson] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSheetConfig().then((c) => {
      if (c.configured) {
        setConfigured(true);
        setSpreadsheetId(c.spreadsheet_id || "");
        setSheetName(c.sheet_name || "Sheet1");
        setMasterKodeTab(c.master_kode_tab || "Kode Produksi");
        setMasterTahapanTab(c.master_tahapan_tab || "Tahapan Standar");
        setMasterLainTab(c.master_lain_tab || "Aktivitas Lain");
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!spreadsheetId.trim()) return toast.show("Isi Spreadsheet ID", "error");
    if (!saJson.trim()) return toast.show("Paste service account JSON", "error");
    try { JSON.parse(saJson); } catch { return toast.show("JSON tidak valid", "error"); }
    setSaving(true);
    try {
      await api.setSheetConfig({
        spreadsheet_id: spreadsheetId.trim(),
        service_account_json: saJson,
        sheet_name: sheetName.trim() || "Sheet1",
        master_kode_tab: masterKodeTab.trim() || "Kode Produksi",
        master_tahapan_tab: masterTahapanTab.trim() || "Tahapan Standar",
        master_lain_tab: masterLainTab.trim() || "Aktivitas Lain",
      });
      toast.show("Konfigurasi tersimpan", "success");
      setConfigured(true);
      setSaJson("");
    } catch (e: any) {
      toast.show(e.message || "Gagal menyimpan", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="btn-back"><Ionicons name="arrow-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Setting Google Sheet</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Ionicons name={configured ? "checkmark-circle" : "alert-circle"} size={22} color={configured ? colors.success : colors.warning} />
              <Text style={styles.statusText}>{configured ? "Sudah terkonfigurasi" : "Belum dikonfigurasi"}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.info}>
              Cara setup:{"\n"}
              1. Buat Service Account di Google Cloud Console{"\n"}
              2. Enable Google Sheets API{"\n"}
              3. Download JSON key{"\n"}
              4. Share Google Sheet Anda ke email service account (Editor){"\n"}
              5. Buat 2 tab tambahan di Spreadsheet: `Kode Produksi` (kolom: Kode | Jenis Produk | Motif | Size) dan `Tahapan Standar` (kolom: Jenis Produk | Tahapan){"\n"}
              6. Paste ID Spreadsheet & isi JSON di bawah, lalu Simpan{"\n"}
              7. Klik "Sync Master" di Dashboard untuk narik data
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Spreadsheet ID *</Text>
            <Text style={styles.hint}>Dari URL: docs.google.com/spreadsheets/d/[ID]/edit</Text>
            <TextInput
              style={styles.input}
              value={spreadsheetId}
              onChangeText={setSpreadsheetId}
              placeholder="1AbC..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              testID="input-sheet-id"
            />

            <Text style={styles.label}>Nama Sheet / Tab (Entri)</Text>
            <TextInput
              style={styles.input}
              value={sheetName}
              onChangeText={setSheetName}
              placeholder="Sheet1"
              placeholderTextColor={colors.muted}
              testID="input-sheet-name"
            />

            <Text style={styles.label}>Tab Master: Kode Produksi</Text>
            <TextInput style={styles.input} value={masterKodeTab} onChangeText={setMasterKodeTab} placeholder="Kode Produksi" placeholderTextColor={colors.muted} testID="input-kode-tab" />

            <Text style={styles.label}>Tab Master: Tahapan Standar</Text>
            <TextInput style={styles.input} value={masterTahapanTab} onChangeText={setMasterTahapanTab} placeholder="Tahapan Standar" placeholderTextColor={colors.muted} testID="input-tahapan-tab" />

            <Text style={styles.label}>Tab Master: Aktivitas Lain</Text>
            <TextInput style={styles.input} value={masterLainTab} onChangeText={setMasterLainTab} placeholder="Aktivitas Lain" placeholderTextColor={colors.muted} testID="input-lain-tab" />

            <Text style={styles.label}>Service Account JSON *</Text>
            <Text style={styles.hint}>Paste seluruh isi file JSON service account</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={saJson}
              onChangeText={setSaJson}
              placeholder='{"type": "service_account", ...}'
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={8}
              autoCapitalize="none"
              testID="input-sa-json"
            />
          </View>
        </ScrollView>
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Pressable style={styles.saveBtn} onPress={save} disabled={saving} testID="btn-save-config">
            {saving ? <ActivityIndicator color="#fff" /> : (
              <><Ionicons name="save" size={20} color="#fff" /><Text style={styles.saveText}>Simpan Konfigurasi</Text></>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusText: { fontWeight: "700", color: colors.onSurface },
  info: { color: colors.onSurface, fontSize: 13, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.md },
  hint: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 14, color: colors.onSurface, backgroundColor: colors.surface },
  textarea: { minHeight: 160, paddingTop: spacing.md, textAlignVertical: "top", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11 },
  bar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  saveBtn: { height: 56, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
