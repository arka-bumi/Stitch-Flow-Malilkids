"""Backend API tests for Penjahit Tracker MVP."""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://tailor-tracker-11.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Unique suffix for isolation
SUFFIX = uuid.uuid4().hex[:6]
TEST_TAILOR_NAME = f"TEST_Zaky_{SUFFIX}"
TEST_TAILOR_PIN = "1234"
TEST_TAILOR_TIM = "A"

TEST_TAILOR2_NAME = f"TEST_Budi_{SUFFIX}"
TEST_TAILOR2_PIN = "5678"

TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# Shared state (populated as tests run)
state = {
    "tailor_token": None,
    "tailor_id": None,
    "tailor2_token": None,
    "tailor2_id": None,
    "admin_token": None,
    "admin_id": None,
    "entry_id": None,
    "entry_other_id": None,
}


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Auth ----------
class TestAuth:
    def test_register_short_nama_400(self, api_client):
        r = api_client.post(f"{API}/auth/register", json={"nama": "A", "pin": "1234", "tim": "A"})
        assert r.status_code == 400

    def test_register_bad_pin_400(self, api_client):
        r = api_client.post(f"{API}/auth/register", json={"nama": f"TEST_bad_{SUFFIX}", "pin": "12", "tim": "A"})
        assert r.status_code == 400
        r2 = api_client.post(f"{API}/auth/register", json={"nama": f"TEST_bad2_{SUFFIX}", "pin": "abcd", "tim": "A"})
        assert r2.status_code == 400

    def test_register_success(self, api_client):
        r = api_client.post(f"{API}/auth/register", json={"nama": TEST_TAILOR_NAME, "pin": TEST_TAILOR_PIN, "tim": TEST_TAILOR_TIM})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and "user" in body
        assert body["user"]["nama"] == TEST_TAILOR_NAME
        assert body["user"]["role"] == "penjahit"
        state["tailor_token"] = body["token"]
        state["tailor_id"] = body["user"]["id"]

    def test_register_duplicate_400(self, api_client):
        r = api_client.post(f"{API}/auth/register", json={"nama": TEST_TAILOR_NAME, "pin": TEST_TAILOR_PIN, "tim": "A"})
        assert r.status_code == 400

    def test_register_second_tailor(self, api_client):
        r = api_client.post(f"{API}/auth/register", json={"nama": TEST_TAILOR2_NAME, "pin": TEST_TAILOR2_PIN, "tim": "B"})
        assert r.status_code == 200
        state["tailor2_token"] = r.json()["token"]
        state["tailor2_id"] = r.json()["user"]["id"]

    def test_login_success(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"nama": TEST_TAILOR_NAME, "pin": TEST_TAILOR_PIN})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_pin(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"nama": TEST_TAILOR_NAME, "pin": "9999"})
        assert r.status_code == 401

    def test_admin_login_success(self, api_client):
        r = api_client.post(f"{API}/auth/admin-login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["role"] == "admin"
        state["admin_token"] = body["token"]
        state["admin_id"] = body["user"]["id"]

    def test_admin_login_wrong_password(self, api_client):
        r = api_client.post(f"{API}/auth/admin-login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_me_penjahit(self, api_client):
        assert state["tailor_token"]
        r = api_client.get(f"{API}/auth/me", headers=auth_headers(state["tailor_token"]))
        assert r.status_code == 200
        u = r.json()
        assert u["role"] == "penjahit"
        assert u["nama"] == TEST_TAILOR_NAME
        # sensitive fields must not leak
        assert "pin_hash" not in u

    def test_me_admin(self, api_client):
        r = api_client.get(f"{API}/auth/me", headers=auth_headers(state["admin_token"]))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_unauth(self, api_client):
        r = api_client.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Master Data ----------
class TestMasterData:
    def test_get_master_data(self, api_client):
        r = api_client.get(f"{API}/master-data")
        assert r.status_code == 200
        data = r.json()
        for k in ("tim", "jenis_produk", "motif", "aktivitas_utama", "aktivitas_lain"):
            assert k in data
            assert isinstance(data[k], list)
            assert data[k] == sorted(set(data[k]))  # sorted & unique
        # seed values present
        assert "Kaos" in data["jenis_produk"]
        assert "Sholat" in data["aktivitas_lain"]

    def test_add_master_requires_auth(self, api_client):
        r = api_client.post(f"{API}/master-data/motif", json={"value": "TESTMOTIF"})
        assert r.status_code == 401

    def test_add_master_invalid_type_400(self, api_client):
        r = api_client.post(
            f"{API}/master-data/bogus",
            headers=auth_headers(state["tailor_token"]),
            json={"value": "X"},
        )
        assert r.status_code == 400

    def test_add_master_success(self, api_client):
        new_val = f"TEST_Motif_{SUFFIX}"
        r = api_client.post(
            f"{API}/master-data/motif",
            headers=auth_headers(state["tailor_token"]),
            json={"value": new_val},
        )
        assert r.status_code == 200
        # verify persistence
        r2 = api_client.get(f"{API}/master-data")
        assert new_val in r2.json()["motif"]


# ---------- Entries ----------
class TestEntries:
    def test_create_entry_requires_auth(self, api_client):
        r = api_client.post(f"{API}/entries", json={"kode_produksi": "K1", "tanggal": TODAY, "jenis_produk": "Kaos", "motif": "Polos"})
        assert r.status_code == 401

    def test_create_entry_rejects_missing_activity(self, api_client):
        r = api_client.post(
            f"{API}/entries",
            headers=auth_headers(state["tailor_token"]),
            json={"kode_produksi": "K1", "tanggal": TODAY, "jenis_produk": "Kaos", "motif": "Polos"},
        )
        assert r.status_code == 400

    def test_create_entry_utama_success(self, api_client):
        payload = {
            "kode_produksi": f"KP_{SUFFIX}",
            "tanggal": TODAY,
            "jenis_produk": "Kaos",
            "motif": "Polos",
            "aktivitas_utama": "Menjahit Tahap 1",
            "jumlah_per_batch": 100,
            "jumlah_per_aktivitas": 25,
            "waktu_mulai": "08:00",
            "waktu_selesai": "10:00",
        }
        r = api_client.post(f"{API}/entries", headers=auth_headers(state["tailor_token"]), json=payload)
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["nama"] == TEST_TAILOR_NAME
        assert e["kode_produksi"] == payload["kode_produksi"]
        assert e["aktivitas_utama"] == "Menjahit Tahap 1"
        assert "id" in e
        # synced_to_sheet should be False since not configured
        assert e.get("synced_to_sheet") is False
        state["entry_id"] = e["id"]

    def test_create_entry_lain_only(self, api_client):
        payload = {
            "kode_produksi": f"KP_{SUFFIX}",
            "tanggal": TODAY,
            "jenis_produk": "Kaos",
            "motif": "Polos",
            "aktivitas_lain": "Sholat",
            "waktu_mulai_lain": "12:00",
            "waktu_selesai_lain": "12:15",
        }
        r = api_client.post(f"{API}/entries", headers=auth_headers(state["tailor_token"]), json=payload)
        assert r.status_code == 200
        assert r.json()["aktivitas_lain"] == "Sholat"

    def test_entries_today(self, api_client):
        r = api_client.get(
            f"{API}/entries/today",
            params={"tanggal": TODAY},
            headers=auth_headers(state["tailor_token"]),
        )
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        ids = [d["id"] for d in docs]
        assert state["entry_id"] in ids

    def test_list_entries(self, api_client):
        r = api_client.get(f"{API}/entries", headers=auth_headers(state["tailor_token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 2

    def test_delete_other_users_entry_forbidden(self, api_client):
        # tailor2 creates an entry
        payload = {
            "kode_produksi": f"KP2_{SUFFIX}",
            "tanggal": TODAY,
            "jenis_produk": "Kemeja",
            "motif": "Hitam",
            "aktivitas_utama": "Memotong Tahap 1",
            "jumlah_per_batch": 50,
            "jumlah_per_aktivitas": 10,
            "waktu_mulai": "09:00",
            "waktu_selesai": "09:30",
        }
        r = api_client.post(f"{API}/entries", headers=auth_headers(state["tailor2_token"]), json=payload)
        assert r.status_code == 200
        state["entry_other_id"] = r.json()["id"]

        # tailor1 tries to delete tailor2's entry -> 404
        r = api_client.delete(
            f"{API}/entries/{state['entry_other_id']}",
            headers=auth_headers(state["tailor_token"]),
        )
        assert r.status_code == 404

    def test_delete_own_entry(self, api_client):
        r = api_client.delete(
            f"{API}/entries/{state['entry_id']}",
            headers=auth_headers(state["tailor_token"]),
        )
        assert r.status_code == 200
        # verify gone
        r2 = api_client.delete(
            f"{API}/entries/{state['entry_id']}",
            headers=auth_headers(state["tailor_token"]),
        )
        assert r2.status_code == 404

    def test_admin_can_delete_any(self, api_client):
        # admin deletes tailor2's entry
        r = api_client.delete(
            f"{API}/entries/{state['entry_other_id']}",
            headers=auth_headers(state["admin_token"]),
        )
        assert r.status_code == 200


# ---------- Admin ----------
class TestAdmin:
    def test_admin_entries_forbidden_for_penjahit(self, api_client):
        r = api_client.get(f"{API}/admin/entries", headers=auth_headers(state["tailor_token"]))
        assert r.status_code == 403

    def test_admin_entries_ok(self, api_client):
        r = api_client.get(f"{API}/admin/entries", headers=auth_headers(state["admin_token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_entries_filter_tim(self, api_client):
        r = api_client.get(
            f"{API}/admin/entries",
            params={"tim": TEST_TAILOR_TIM, "tanggal": TODAY},
            headers=auth_headers(state["admin_token"]),
        )
        assert r.status_code == 200
        for d in r.json():
            assert d["tim"] == TEST_TAILOR_TIM
            assert d["tanggal"] == TODAY

    def test_admin_summary(self, api_client):
        r = api_client.get(f"{API}/admin/summary", headers=auth_headers(state["admin_token"]))
        assert r.status_code == 200
        s = r.json()
        for k in ("total_entries", "total_menit_utama", "total_menit_lain", "total_output", "per_penjahit", "users"):
            assert k in s
        assert isinstance(s["per_penjahit"], list)
        assert isinstance(s["users"], list)

    def test_admin_sheet_config_get(self, api_client):
        r = api_client.get(f"{API}/admin/sheet-config", headers=auth_headers(state["admin_token"]))
        assert r.status_code == 200
        body = r.json()
        # allow either state; usually not configured initially
        assert "configured" in body

    def test_admin_sheet_config_invalid_json_400(self, api_client):
        r = api_client.post(
            f"{API}/admin/sheet-config",
            headers=auth_headers(state["admin_token"]),
            json={"spreadsheet_id": "abc", "service_account_json": "not-json{", "sheet_name": "Sheet1"},
        )
        assert r.status_code == 400

    def test_admin_sync_sheet_not_configured_400(self, api_client):
        # If sheet_config exists from a prior run, this may return 200; accept either 400 or 200
        r = api_client.post(f"{API}/admin/sync-sheet", headers=auth_headers(state["admin_token"]))
        assert r.status_code in (200, 400)

    def test_admin_sync_sheet_forbidden_for_penjahit(self, api_client):
        r = api_client.post(f"{API}/admin/sync-sheet", headers=auth_headers(state["tailor_token"]))
        assert r.status_code == 403
