# DAN'S INVENTORY SYSTEM v2.1
**Next.js + Supabase + Vercel | Gudang Topi**

---

## CARA DEPLOY

### STEP 1 — Supabase (database)
1. https://supabase.com → New Project → region: Singapore
2. SQL Editor → paste isi `supabase-schema.sql` → Run
3. Settings → API → copy **Project URL** dan **anon public key**

### STEP 2 — GitHub
Upload semua file project ini ke repo GitHub baru.

### STEP 3 — Vercel
1. https://vercel.com → New Project → import repo GitHub
2. Settings → Environment Variables → tambahkan:

```
NEXT_PUBLIC_SUPABASE_URL      = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGci...
TELEGRAM_BOT_TOKEN            = 1234567890:ABCDEFxxx   (opsional)
TELEGRAM_CHAT_ID              = -1001234567890          (opsional)
CRON_SECRET                   = password_bebas          (opsional)
```

3. Deploy → selesai!

---

## SETUP TELEGRAM BOT (laporan otomatis)

1. Chat @BotFather di Telegram → /newbot → copy Token
2. Start bot lo → buka `api.telegram.org/botTOKEN/getUpdates` → copy Chat ID
3. Isi env var TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID di Vercel
4. Redeploy

**Jadwal laporan:**
- 📋 **Harian** — setiap hari jam 20:00 WIB (13:00 UTC)
- 📊 **Mingguan** — setiap Senin jam 20:00 WIB

Bisa juga trigger manual: `GET /api/laporan-harian` atau `/api/laporan-mingguan`

---

## FITUR v2.1

| Fitur | Status |
|-------|--------|
| CRUD Barang | ✅ |
| Pemasukan + stok otomatis | ✅ |
| Pengeluaran + validasi stok | ✅ |
| Formula stok real-time (SQL VIEW) | ✅ |
| Preview stok sebelum/sesudah | ✅ |
| Export CSV (Excel-compatible, BOM) | ✅ Fixed |
| Export JSON | ✅ Fixed |
| Import JSON | ✅ New |
| Telegram laporan harian | ✅ New |
| Telegram laporan mingguan | ✅ New |
| Warning stok rendah | ✅ New |
| Data cloud permanen (Supabase) | ✅ |

---

## JENIS SATUAN
Bungkus · Kodi · Picis · Golong · Meter

## DEV LOKAL
```bash
npm install
cp .env.local.example .env.local
# isi env var
npm run dev
```
