from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, date
import bcrypt
import jwt

from google.oauth2 import service_account
from googleapiclient.discovery import build

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'penjahit-super-secret-change-me')
JWT_ALGO = 'HS256'

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Models ----------
class RegisterBody(BaseModel):
    nama: str
    pin: str
    tim: str

class LoginBody(BaseModel):
    nama: str
    pin: str

class AdminLoginBody(BaseModel):
    username: str
    password: str

class AktivitasLain(BaseModel):
    nama: str
    waktu_mulai: str  # HH:mm
    waktu_selesai: str

class EntryCreate(BaseModel):
    kode_produksi: str
    tanggal: str  # YYYY-MM-DD
    jenis_produk: str
    motif: str
    aktivitas_utama: Optional[str] = None
    jumlah_per_batch: Optional[int] = None
    jumlah_per_aktivitas: Optional[int] = None
    waktu_mulai: Optional[str] = None
    waktu_selesai: Optional[str] = None
    aktivitas_lain: Optional[str] = None
    waktu_mulai_lain: Optional[str] = None
    waktu_selesai_lain: Optional[str] = None

class MasterAdd(BaseModel):
    value: str

class SheetConfig(BaseModel):
    spreadsheet_id: str
    service_account_json: str  # raw JSON string
    sheet_name: Optional[str] = "Sheet1"

# ---------- Helpers ----------
def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()

def verify_pin(pin: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pin.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user_id: str, role: str) -> str:
    return jwt.encode({"sub": user_id, "role": role, "iat": datetime.now(timezone.utc).timestamp()}, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "pin_hash": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["role"] = payload.get("role", user.get("role", "penjahit"))
    return user

async def require_admin(user = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

# ---------- Google Sheets Sync ----------
SHEET_HEADERS = [
    "Nama", "Kode Produksi", "Tanggal", "Tim", "Jenis Produk", "Motif",
    "Aktivitas Utama", "Jumlah Per Batch", "Jumlah Per Aktivitas",
    "Waktu Mulai", "Waktu Selesai",
    "Aktivitas Lain", "Waktu Mulai Lain", "Waktu Selesai Lain",
]

def _entry_to_row(entry: dict) -> list:
    return [
        entry.get("nama", ""),
        entry.get("kode_produksi", ""),
        entry.get("tanggal", ""),
        entry.get("tim", ""),
        entry.get("jenis_produk", ""),
        entry.get("motif", ""),
        entry.get("aktivitas_utama", "") or "",
        entry.get("jumlah_per_batch", "") if entry.get("jumlah_per_batch") is not None else "",
        entry.get("jumlah_per_aktivitas", "") if entry.get("jumlah_per_aktivitas") is not None else "",
        entry.get("waktu_mulai", "") or "",
        entry.get("waktu_selesai", "") or "",
        entry.get("aktivitas_lain", "") or "",
        entry.get("waktu_mulai_lain", "") or "",
        entry.get("waktu_selesai_lain", "") or "",
    ]

def _get_sheets_service_sync(sa_json_str: str):
    info = json.loads(sa_json_str)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build('sheets', 'v4', credentials=creds, cache_discovery=False)

def _ensure_headers_sync(service, spreadsheet_id: str, sheet_name: str):
    try:
        res = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, range=f"{sheet_name}!A1:N1"
        ).execute()
        values = res.get("values", [])
        if not values or values[0] != SHEET_HEADERS:
            service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"{sheet_name}!A1:N1",
                valueInputOption="RAW",
                body={"values": [SHEET_HEADERS]},
            ).execute()
    except Exception as e:
        logger.error(f"Ensure headers failed: {e}")

def _append_row_sync(sa_json_str: str, spreadsheet_id: str, sheet_name: str, row: list):
    service = _get_sheets_service_sync(sa_json_str)
    _ensure_headers_sync(service, spreadsheet_id, sheet_name)
    service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!A:N",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()

async def sync_entry_to_sheet(entry: dict) -> bool:
    cfg = await db.sheet_config.find_one({"id": "default"}, {"_id": 0})
    if not cfg or not cfg.get("spreadsheet_id") or not cfg.get("service_account_json"):
        return False
    try:
        await asyncio.to_thread(
            _append_row_sync,
            cfg["service_account_json"],
            cfg["spreadsheet_id"],
            cfg.get("sheet_name") or "Sheet1",
            _entry_to_row(entry),
        )
        return True
    except Exception as e:
        logger.error(f"Sheet sync failed: {e}")
        return False

# ---------- Auth Routes ----------
@api_router.post("/auth/register")
async def register(body: RegisterBody):
    nama_norm = body.nama.strip()
    if len(nama_norm) < 2:
        raise HTTPException(status_code=400, detail="Nama minimal 2 karakter")
    if not (body.pin.isdigit() and 4 <= len(body.pin) <= 6):
        raise HTTPException(status_code=400, detail="PIN harus 4-6 digit angka")
    existing = await db.users.find_one({"nama_lower": nama_norm.lower(), "role": "penjahit"})
    if existing:
        raise HTTPException(status_code=400, detail="Nama sudah terdaftar")
    user = {
        "id": str(uuid.uuid4()),
        "nama": nama_norm,
        "nama_lower": nama_norm.lower(),
        "tim": body.tim.strip(),
        "role": "penjahit",
        "pin_hash": hash_pin(body.pin),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    # ensure team in master data
    await db.master_data.update_one(
        {"type": "tim", "value_lower": body.tim.strip().lower()},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "type": "tim", "value": body.tim.strip(), "value_lower": body.tim.strip().lower()}},
        upsert=True,
    )
    token = make_token(user["id"], "penjahit")
    return {"token": token, "user": {"id": user["id"], "nama": user["nama"], "tim": user["tim"], "role": "penjahit"}}

@api_router.post("/auth/login")
async def login(body: LoginBody):
    nama_norm = body.nama.strip()
    user = await db.users.find_one({"nama_lower": nama_norm.lower(), "role": "penjahit"})
    if not user or not verify_pin(body.pin, user["pin_hash"]):
        raise HTTPException(status_code=401, detail="Nama atau PIN salah")
    token = make_token(user["id"], "penjahit")
    return {"token": token, "user": {"id": user["id"], "nama": user["nama"], "tim": user["tim"], "role": "penjahit"}}

@api_router.post("/auth/admin-login")
async def admin_login(body: AdminLoginBody):
    admin = await db.users.find_one({"username": body.username.strip().lower(), "role": "admin"})
    if not admin:
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not verify_pin(body.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = make_token(admin["id"], "admin")
    return {"token": token, "user": {"id": admin["id"], "nama": admin.get("nama", "Admin"), "role": "admin"}}

@api_router.get("/auth/me")
async def me(user = Depends(get_current_user)):
    return user

# ---------- Master Data ----------
DEFAULT_MASTER = {
    "tim": ["A", "B", "C"],
    "jenis_produk": ["Kaos", "Kemeja", "Celana", "Jaket"],
    "motif": ["Hitam", "Putih", "Polos", "Motif"],
    "aktivitas_utama": ["Memotong Tahap 1", "Finalisasi Potong", "Menjahit Tahap 1", "Finalisasi Jahitan", "Mengobras", "Finishing"],
    "aktivitas_lain": ["Ke Toilet", "Makan", "Sholat", "Istirahat", "Bantu Numpuk", "Ambil Bahan"],
}

@api_router.get("/master-data")
async def get_master_data():
    result = {k: [] for k in DEFAULT_MASTER.keys()}
    docs = await db.master_data.find({}, {"_id": 0}).to_list(1000)
    for d in docs:
        t = d.get("type")
        if t in result:
            result[t].append(d["value"])
    for k, v in result.items():
        result[k] = sorted(set(v))
    return result

@api_router.post("/master-data/{type_}")
async def add_master(type_: str, body: MasterAdd, user = Depends(get_current_user)):
    if type_ not in DEFAULT_MASTER:
        raise HTTPException(status_code=400, detail="Tipe tidak valid")
    v = body.value.strip()
    if not v:
        raise HTTPException(status_code=400, detail="Nilai kosong")
    await db.master_data.update_one(
        {"type": type_, "value_lower": v.lower()},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "type": type_, "value": v, "value_lower": v.lower()}},
        upsert=True,
    )
    return {"ok": True, "value": v}

# ---------- Entries ----------
@api_router.post("/entries")
async def create_entry(body: EntryCreate, user = Depends(get_current_user)):
    # basic validation
    if not body.aktivitas_utama and not body.aktivitas_lain:
        raise HTTPException(status_code=400, detail="Harus isi Aktivitas Utama atau Aktivitas Lain")
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "nama": user["nama"],
        "tim": user["tim"],
        "kode_produksi": body.kode_produksi.strip(),
        "tanggal": body.tanggal,
        "jenis_produk": body.jenis_produk,
        "motif": body.motif,
        "aktivitas_utama": body.aktivitas_utama,
        "jumlah_per_batch": body.jumlah_per_batch,
        "jumlah_per_aktivitas": body.jumlah_per_aktivitas,
        "waktu_mulai": body.waktu_mulai,
        "waktu_selesai": body.waktu_selesai,
        "aktivitas_lain": body.aktivitas_lain,
        "waktu_mulai_lain": body.waktu_mulai_lain,
        "waktu_selesai_lain": body.waktu_selesai_lain,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "synced_to_sheet": False,
    }
    await db.entries.insert_one(dict(entry))
    synced = await sync_entry_to_sheet(entry)
    if synced:
        await db.entries.update_one({"id": entry["id"]}, {"$set": {"synced_to_sheet": True}})
        entry["synced_to_sheet"] = True
    entry.pop("_id", None)
    return entry

@api_router.get("/entries/today")
async def entries_today(tanggal: Optional[str] = None, user = Depends(get_current_user)):
    # Client should pass local YYYY-MM-DD. Fallback = UTC date (may differ from client TZ).
    today = tanggal or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await db.entries.find({"user_id": user["id"], "tanggal": today}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.get("/entries")
async def list_entries(user = Depends(get_current_user)):
    docs = await db.entries.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user = Depends(get_current_user)):
    q = {"id": entry_id}
    if user.get("role") != "admin":
        q["user_id"] = user["id"]
    res = await db.entries.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}

# ---------- Admin ----------
@api_router.get("/admin/entries")
async def admin_entries(
    tanggal: Optional[str] = None,
    tim: Optional[str] = None,
    user_id: Optional[str] = None,
    admin = Depends(require_admin),
):
    q: dict = {}
    if tanggal:
        q["tanggal"] = tanggal
    if tim:
        q["tim"] = tim
    if user_id:
        q["user_id"] = user_id
    docs = await db.entries.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs

@api_router.get("/admin/summary")
async def admin_summary(tanggal: Optional[str] = None, admin = Depends(require_admin)):
    q: dict = {}
    if tanggal:
        q["tanggal"] = tanggal
    docs = await db.entries.find(q, {"_id": 0}).to_list(5000)

    def to_minutes(t):
        if not t: return 0
        try:
            hh, mm = t.split(":")
            return int(hh) * 60 + int(mm)
        except Exception:
            return 0

    total_utama_min = 0
    total_lain_min = 0
    total_output = 0
    per_penjahit: dict = {}
    for d in docs:
        um = max(0, to_minutes(d.get("waktu_selesai")) - to_minutes(d.get("waktu_mulai")))
        lm = max(0, to_minutes(d.get("waktu_selesai_lain")) - to_minutes(d.get("waktu_mulai_lain")))
        total_utama_min += um
        total_lain_min += lm
        if d.get("jumlah_per_aktivitas"):
            total_output += int(d["jumlah_per_aktivitas"])
        key = d.get("user_id") or d.get("nama")
        p = per_penjahit.setdefault(key, {"nama": d.get("nama"), "tim": d.get("tim"), "menit_utama": 0, "menit_lain": 0, "output": 0, "entries": 0})
        p["menit_utama"] += um
        p["menit_lain"] += lm
        if d.get("jumlah_per_aktivitas"):
            p["output"] += int(d["jumlah_per_aktivitas"])
        p["entries"] += 1

    users = await db.users.find({"role": "penjahit"}, {"_id": 0, "pin_hash": 0}).to_list(500)
    return {
        "total_entries": len(docs),
        "total_menit_utama": total_utama_min,
        "total_menit_lain": total_lain_min,
        "total_output": total_output,
        "per_penjahit": list(per_penjahit.values()),
        "users": users,
    }

@api_router.get("/admin/sheet-config")
async def get_sheet_config(admin = Depends(require_admin)):
    cfg = await db.sheet_config.find_one({"id": "default"}, {"_id": 0, "service_account_json": 0})
    if not cfg:
        return {"configured": False}
    return {"configured": True, "spreadsheet_id": cfg.get("spreadsheet_id"), "sheet_name": cfg.get("sheet_name", "Sheet1")}

@api_router.post("/admin/sheet-config")
async def set_sheet_config(body: SheetConfig, admin = Depends(require_admin)):
    try:
        json.loads(body.service_account_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Service account JSON tidak valid")
    await db.sheet_config.update_one(
        {"id": "default"},
        {"$set": {
            "id": "default",
            "spreadsheet_id": body.spreadsheet_id.strip(),
            "service_account_json": body.service_account_json,
            "sheet_name": body.sheet_name or "Sheet1",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}

@api_router.post("/admin/sync-sheet")
async def sync_all(admin = Depends(require_admin)):
    cfg = await db.sheet_config.find_one({"id": "default"}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=400, detail="Sheet belum dikonfigurasi")
    unsynced = await db.entries.find({"synced_to_sheet": {"$ne": True}}, {"_id": 0}).to_list(2000)
    ok = 0
    fail = 0
    for e in unsynced:
        s = await sync_entry_to_sheet(e)
        if s:
            await db.entries.update_one({"id": e["id"]}, {"$set": {"synced_to_sheet": True}})
            ok += 1
        else:
            fail += 1
    return {"synced": ok, "failed": fail, "total_unsynced_before": len(unsynced)}

@api_router.get("/")
async def root():
    return {"message": "Penjahit Tracker API"}

# ---------- Seed ----------
async def seed_data():
    # Admin
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": "admin",
            "nama": "Administrator",
            "role": "admin",
            "password_hash": hash_pin("admin123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user: admin / admin123")
    # Master data
    for t, values in DEFAULT_MASTER.items():
        for v in values:
            await db.master_data.update_one(
                {"type": t, "value_lower": v.lower()},
                {"$setOnInsert": {"id": str(uuid.uuid4()), "type": t, "value": v, "value_lower": v.lower()}},
                upsert=True,
            )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup():
    await seed_data()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
