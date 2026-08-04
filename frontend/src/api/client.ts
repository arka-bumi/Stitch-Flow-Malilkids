import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const TOKEN_KEY = "penjahit_token";
export const USER_KEY = "penjahit_user";

async function authHeader() {
  const t = await AsyncStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req(path: string, opts: RequestInit = {}) {
  const headers: any = { "Content-Type": "application/json", ...(await authHeader()), ...(opts.headers || {}) };
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
  if (!res.ok) {
    const msg = data?.detail || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

export const api = {
  register: (nama: string, pin: string, tim: string) =>
    req("/auth/register", { method: "POST", body: JSON.stringify({ nama, pin, tim }) }),
  login: (nama: string, pin: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ nama, pin }) }),
  adminLogin: (username: string, password: string) =>
    req("/auth/admin-login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => req("/auth/me"),

  getMaster: () => req("/master-data"),
  addMaster: (type: string, value: string) =>
    req(`/master-data/${type}`, { method: "POST", body: JSON.stringify({ value }) }),

  createEntry: (payload: any) => req("/entries", { method: "POST", body: JSON.stringify(payload) }),
  entriesToday: (tanggal?: string) => req(`/entries/today${tanggal ? `?tanggal=${tanggal}` : ""}`),
  entriesAll: () => req("/entries"),
  deleteEntry: (id: string) => req(`/entries/${id}`, { method: "DELETE" }),

  adminEntries: (params: { tanggal?: string; tim?: string; user_id?: string }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.append(k, String(v)));
    return req(`/admin/entries${q.toString() ? `?${q.toString()}` : ""}`);
  },
  adminSummary: (tanggal?: string) => req(`/admin/summary${tanggal ? `?tanggal=${tanggal}` : ""}`),
  getSheetConfig: () => req("/admin/sheet-config"),
  setSheetConfig: (spreadsheet_id: string, service_account_json: string, sheet_name?: string) =>
    req("/admin/sheet-config", {
      method: "POST",
      body: JSON.stringify({ spreadsheet_id, service_account_json, sheet_name }),
    }),
  syncSheet: () => req("/admin/sync-sheet", { method: "POST" }),
};

export async function saveAuth(token: string, user: any) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function clearAuth() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}
export async function getStoredUser() {
  const u = await AsyncStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}
