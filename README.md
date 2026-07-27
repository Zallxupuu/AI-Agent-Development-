# AI Agent Customer Service untuk WhatsApp

Proyek ini adalah sebuah sistem Customer Service cerdas terpadu yang terhubung dengan WhatsApp API (Meta) dan didukung oleh kecerdasan buatan Google Gemini. Proyek ini dibangun menggunakan **Next.js 16 (App Router)** dan **Supabase**.

## Fitur Utama

- **Auto-Reply Cerdas (AI):** Membalas pesan pelanggan secara otomatis 24/7 menggunakan model AI `gemini-flash-lite-latest` dengan gaya bahasa yang gaul, santai, dan bersahabat.
- **Dashboard Admin Realtime:** Memantau seluruh percakapan masuk secara *realtime* (tanpa perlu *refresh*) menggunakan kapabilitas *realtime* dari Supabase.
- **Ambil Alih Manual (Manual Reply):** Admin bisa mematikan bot AI kapan saja dan membalas pesan secara manual langsung dari dashboard web.
- **Sistem Sesi Otomatis:** Sistem mendeteksi nomor telepon yang masuk, membuat/memperbarui sesi obrolan, dan menyimpan riwayat percakapan.

## Persyaratan (Prerequisites)

Sebelum menjalankan proyek ini, pastikan Anda telah memiliki hal-hal berikut:

1. **Node.js** (Versi 18+ disarankan)
2. **Akun Supabase** (untuk Database & Realtime)
3. **Akun Meta for Developers** (untuk WhatsApp Cloud API)
4. **Google Gemini API Key** (dari Google AI Studio)
5. **Ngrok** atau **Cloudflared** (untuk *tunneling* Webhook saat masa pengembangan)

---

## 🛠 Instalasi dan Konfigurasi

### 1. Kloning Repositori
Clone repositori ini ke komputer Anda dan masuk ke dalam direktorinya.

### 2. Instalasi Dependensi
Jalankan perintah berikut untuk menginstal semua library yang dibutuhkan:
```bash
npm install
```

### 3. Konfigurasi Database (Supabase)
Buat proyek baru di [Supabase](https://supabase.com). Jalankan perintah SQL berikut di menu **SQL Editor** untuk membuat tabel yang dibutuhkan:

```sql
-- Tabel sessions
CREATE TABLE sessions (
  phone_number TEXT PRIMARY KEY,
  is_bot_active BOOLEAN DEFAULT true,
  last_active TIMESTAMPTZ DEFAULT now()
);

-- Tabel messages
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT REFERENCES sessions(phone_number) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('client', 'ai', 'admin')),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Sangat Penting (Keamanan & Realtime):**
- Di menu **Authentication > Policies**, pastikan Anda **mematikan** fitur *Row Level Security* (RLS) untuk tabel `sessions` dan `messages` agar dashboard admin bisa membaca data.
- Di menu **Database > Publications**, klik setelan untuk `supabase_realtime` lalu centang tabel `sessions` dan `messages` agar fitur *realtime* di dashboard web berfungsi.

### 4. Konfigurasi Environment Variables
Buat sebuah file bernama `.env.local` di folder *root* proyek ini, dan isi dengan kredensial Anda:

```env
# URL & Kunci dari Dashboard Supabase Anda (Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey... (kunci anonim pubik)
SUPABASE_SERVICE_ROLE_KEY=ey... (kunci service role rahasia)

# Kunci API dari Google AI Studio
GEMINI_API_KEY=AI...

# Kredensial dari Meta WhatsApp Dashboard
WHATSAPP_TOKEN=EA... (System User Access Token / Temporary Token)
WHATSAPP_PHONE_NUMBER_ID=123... (Phone Number ID)
WHATSAPP_VERIFY_TOKEN=bebas_rahasia_apa_saja
```

---

## 🚀 Cara Menjalankan

### 1. Jalankan Server Next.js
Jalankan server aplikasi di lingkungan pengembangan (development):
```bash
npm run dev
```
Server akan berjalan di `http://localhost:3000`. Jika Anda membuka URL ini di browser, Anda akan melihat Dashboard Admin.

### 2. Jalankan Tunneling (Ngrok / Cloudflare)
Meta WhatsApp API mewajibkan *Webhook* menggunakan HTTPS publik. Karena aplikasi berjalan di *localhost*, kita harus membuat "jembatan" (*tunneling*).

Buka terminal/Command Prompt **baru**, lalu jalankan salah satu perintah berikut:

**Menggunakan Ngrok:**
```bash
ngrok http 3000
```
*(Copy URL `https://...ngrok-free.app`)*

**Menggunakan Cloudflare Tunnel (Tanpa Akun):**
```bash
npx -y cloudflared tunnel --url http://localhost:3000
```
*(Copy URL `https://...trycloudflare.com`)*

### 3. Daftarkan Webhook di Meta Dashboard
1. Buka dashboard aplikasi WhatsApp Anda di Meta for Developers.
2. Buka menu **WhatsApp > Konfigurasi > Webhooks** (atau di bagian Langkah 2).
3. Klik tombol edit/pengaturan Webhook.
4. Masukkan **URL Webhook**: `[URL_DARI_TUNNEL]/api/webhook` (Misal: `https://contoh.ngrok-free.app/api/webhook`).
5. Masukkan **Verify Token**: (Sesuai dengan `WHATSAPP_VERIFY_TOKEN` di `.env.local`).
6. Klik "Verify and Save".
7. Setelah tersimpan, cari bagian "Webhook Fields", temukan **`messages`**, lalu klik tombol **Berlangganan (Subscribe)**.

Semuanya Selesai! Sekarang Anda bisa mengirim chat ke nomor WhatsApp bot Anda, dan pesan akan langsung terkirim ke dashboard serta otomatis dibalas oleh AI.

---

## Mematikan Fitur AI (Manual Reply)
Untuk mengambil alih percakapan (mematikan balasan AI otomatis), cukup buka dashboard web `http://localhost:3000`, pilih nomor kontak yang sedang aktif, dan tekan tombol *switch/toggle* **Auto-Reply AI** di pojok kanan atas hingga berubah warna dari biru menjadi abu-abu. 

Setelah AI mati, Anda bisa mengetik dan membalas pesannya secara manual dari kotak chat di bawah!
