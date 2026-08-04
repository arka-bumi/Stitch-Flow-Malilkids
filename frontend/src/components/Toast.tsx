import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, radius, spacing } from "../theme/colors";

type ToastCtx = { show: (msg: string, type?: "success" | "error" | "info") => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string>("");
  const [type, setType] = useState<"success" | "error" | "info">("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  const show = useCallback((m: string, t: "success" | "error" | "info" = "info") => {
    setMsg(m); setType(t);
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, 2500);
  }, [opacity]);

  const bg = type === "success" ? colors.success : type === "error" ? colors.error : colors.surfaceInverse;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.toast, { opacity, backgroundColor: bg }]} testID="toast">
        <Text style={styles.text}>{msg}</Text>
      </Animated.View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute", top: 60, left: spacing.lg, right: spacing.lg,
    padding: spacing.md, borderRadius: radius.md, zIndex: 9999,
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },
});
