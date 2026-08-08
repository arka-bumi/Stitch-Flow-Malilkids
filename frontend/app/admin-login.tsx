import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme/colors";
import { api, saveAuth } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

export default function AdminLogin() {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password.trim()) return toast.show("Lengkapi form", "error");
    setLoading(true);
    try {
      const res = await api.adminLogin(username, password);
      await saveAuth(res.token, res.user);
      router.replace("/admin/dashboard");
    } catch (e: any) {
      toast.show(e.message || "Gagal login", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="btn-back">
            <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Login Admin</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={64} color={colors.brandPrimary} />
          </View>
          <Text style={styles.subtitle}>Akses Dashboard Admin</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="admin"
            placeholderTextColor={colors.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            testID="admin-username"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="admin-password"
          />

          <Pressable style={styles.submitBtn} onPress={submit} disabled={loading} testID="admin-submit">
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Masuk</Text>}
          </Pressable>

          <Text style={styles.hint}>Hubungi super-admin jika lupa password.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  iconWrap: { alignItems: "center", marginVertical: spacing.xl },
  subtitle: { textAlign: "center", fontSize: 16, color: colors.muted, marginBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface,
  },
  submitBtn: {
    marginTop: spacing.xl, height: 56, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { textAlign: "center", marginTop: spacing.lg, color: colors.muted, fontSize: 12 },
});
