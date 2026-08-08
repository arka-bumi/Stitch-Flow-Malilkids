import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api, saveAuth, getStoredUser } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

const HERO = "https://images.unsplash.com/photo-1675176785803-bffbbb0cd2f4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDZ8MHwxfHNlYXJjaHwxfHxzZXdpbmclMjBtYWNoaW5lJTIwdGV4dGlsZSUyMGZhY3Rvcnl8ZW58MHx8fHwxNzgyNTgwMjg1fDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const [nama, setNama] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getStoredUser();
      if (u?.role === "admin") router.replace("/admin/dashboard");
      else if (u?.role === "penjahit") router.replace("/(tabs)/beranda");
      setChecking(false);
    })();
  }, []);

  const submit = async () => {
    if (!nama.trim() || !pin.trim()) return toast.show("Isi nama dan PIN", "error");
    setLoading(true);
    try {
      const res = await api.login(nama, pin);
      await saveAuth(res.token, res.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/beranda");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show(e.message || "Gagal login", "error");
    } finally { setLoading(false); }
  };

  if (checking) {
    return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={styles.heroImg} />
          <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]} style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Formulir Input Pekerjaan</Text>
            <Text style={styles.heroSub}>Masuk untuk mencatat aktivitas</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nama</Text>
          <TextInput
            style={styles.input} placeholder="Nama lengkap" placeholderTextColor={colors.muted}
            value={nama} onChangeText={setNama} autoCapitalize="words" testID="input-nama"
          />
          <Text style={styles.label}>PIN</Text>
          <TextInput
            style={styles.input} placeholder="••••" placeholderTextColor={colors.muted}
            value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad" secureTextEntry testID="input-pin"
          />
          <Pressable style={styles.submitBtn} onPress={submit} disabled={loading} testID="btn-submit">
            {loading ? <ActivityIndicator color="#fff" /> : (
              <><Ionicons name="log-in-outline" size={20} color="#fff" /><Text style={styles.submitText}>Masuk</Text></>
            )}
          </Pressable>
          <Pressable style={styles.adminLink} onPress={() => router.push("/admin-login")} testID="btn-admin-login">
            <Ionicons name="shield-outline" size={16} color={colors.muted} />
            <Text style={styles.adminLinkText}>Masuk sebagai Admin</Text>
          </Pressable>
          <Text style={styles.hint}>Belum punya akun? Hubungi admin.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface },
  hero: { height: 260, position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroText: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, flex: 1 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface },
  submitBtn: { marginTop: spacing.xl, height: 56, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  adminLink: { marginTop: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.md },
  adminLinkText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  hint: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.sm },
});
