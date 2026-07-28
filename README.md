# 🤖 WhatsApp AI Agent Dashboard

Sistem Customer Service cerdas terpadu yang terhubung dengan **WhatsApp API (Meta)** dan didukung oleh kecerdasan buatan **Google Gemini**. Proyek ini dibangun menggunakan Next.js 16 (App Router) dan Supabase.

Aplikasi ini ditujukan untuk mempermudah admin dalam memantau, membalas, dan mengotomatisasi balasan ke pelanggan WhatsApp secara *real-time*.

---

## 🛠️ 1. Apa Saja yang Perlu Diinstall? (Prerequisites)

Untuk menjalankan dan mengembangkan aplikasi ini di komputer Anda, Anda membutuhkan beberapa *tools* berikut:

1. **Node.js**: Versi 18 atau lebih baru. (Download di [nodejs.org](https://nodejs.org/)).
2. **Akun Supabase**: Sebagai *database* utama dan penyedia fitur *real-time websocket*. (Daftar gratis di [supabase.com](https://supabase.com/)).
3. **Akun Meta for Developers**: Untuk mengaktifkan WhatsApp Cloud API dan mendapatkan kredensial pengiriman pesan. (Daftar di [developers.facebook.com](https://developers.facebook.com/)).
4. **Google Gemini API Key**: Kunci akses untuk kecerdasan buatan (AI) pembalas pesan otomatis. (Dapatkan di [Google AI Studio](https://aistudio.google.com/)).
5. **Ngrok / Cloudflared**: *Software tunneling* untuk mengekspos *localhost* Anda menjadi URL publik (HTTPS) agar bisa menerima *Webhook* dari WhatsApp.

---

## 🚀 2. Cara Install dan Menjalankan Proyek

### A. Kloning dan Instalasi
Buka terminal/Command Prompt Anda, lalu jalankan:
```bash
git clone https://github.com/Zallxupuu/AI-Agent-Development-.git
cd AI-Agent-Development-
npm install
```

### B. Setup Database Supabase
1. Buat proyek baru di [Supabase Dashboard](https://supabase.com).
2. Buka menu **SQL Editor**, dan jalankan perintah SQL ini untuk membuat tabel:

```sql
CREATE TABLE sessions (
  phone_number TEXT PRIMARY KEY,
  is_bot_active BOOLEAN DEFAULT true,
  last_active TIMESTAMPTZ DEFAULT now(),
  status TEXT
);

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT REFERENCES sessions(phone_number) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('client', 'ai', 'admin')),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  category TEXT
);

CREATE TABLE ai_config (
  id INT PRIMARY KEY,
  store_url TEXT,
  qris_url TEXT,
  system_prompt TEXT
);

-- Masukkan konfigurasi awal
INSERT INTO ai_config (id, store_url, qris_url, system_prompt)
VALUES (1, 'https://toko.com', 'https://qris.com/bayar', 'Anda adalah CS yang ramah...');
```

> **SANGAT PENTING**: 
> 1. Di menu **Authentication > Policies**, matikan (*disable*) **Row Level Security (RLS)** untuk semua tabel di atas.
> 2. Di menu **Database > Publications**, edit publikasi `supabase_realtime` dan pastikan tabel `sessions` dan `messages` dicentang agar notifikasi *real-time* berfungsi!

### C. Konfigurasi Environment Variables (`.env.local`)
Buat file `.env.local` di dalam folder root aplikasi Anda, dan isi dengan kredensial berikut:

```env
# URL & Kunci dari Dashboard Supabase Anda (Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey... (kunci rahasia/secret)

# Kunci API dari Google AI Studio
GEMINI_API_KEY=AIzaSy...

# Kredensial dari Meta WhatsApp Dashboard
WHATSAPP_TOKEN=EA... (System User Access Token / Temporary Token)
WHATSAPP_PHONE_NUMBER_ID=123... (Phone Number ID)
WHATSAPP_VERIFY_TOKEN=rahasia_bebas_kamu (Bisa diisi teks acak apa saja)
```

### D. Jalankan Server
```bash
npm run dev
```
Buka browser di `http://localhost:3000`. Dashboard Admin akan terbuka!

### E. Setup Webhook WhatsApp
1. Buka terminal baru dan jalankan Ngrok: `ngrok http 3000`.
2. Salin URL HTTPS yang muncul (misal: `https://abcd.ngrok-free.app`).
3. Buka Dashboard Meta WhatsApp > Webhooks.
4. Masukkan URL: `https://abcd.ngrok-free.app/api/webhook`.
5. Masukkan Verify Token sesuai dengan yang Anda tulis di `.env.local`.
6. Subscribe (berlangganan) ke **messages**.

Selamat! Aplikasi sudah siap digunakan! 🎉

---

## 💻 3. Cara Mengembangkan untuk Sendiri (Development Guide)

Jika Anda seorang *developer* dan ingin menyesuaikan (*customize*) aplikasi ini untuk bisnis Anda sendiri, Anda bisa memodifikasi bagian-bagian berikut:

### Apa Saja yang Bisa Diedit / Dikustomisasi?

1. **Prompt dan Kepribadian AI (`lib/gemini.ts`)**
   Anda dapat mengubah *behavior* bot di file ini, meskipun secara *default* sudah diarahkan untuk mengambil *prompt* dari database (lewat menu **Pengaturan AI** di Dashboard). Namun, *logic fallback* atau injeksi produk bisa diedit di file ini.

2. **Tema dan Warna Utama (`app/globals.css` & `tailwind.config.ts`)**
   Warna utama aplikasi diatur menggunakan *CSS Variables*. Anda bisa mengubah kode warna `--primary` di dalam `globals.css` untuk menyesuaikan dengan warna logo/bisnis Anda.
   
3. **Logika Webhook & Meta API (`app/api/webhook/route.ts`)**
   Jika Anda ingin menambahkan fitur seperti "Auto-Reply saat di luar jam kerja" atau "Menyimpan gambar dari pelanggan ke Supabase Storage", Anda bisa langsung membongkar *endpoint* Webhook ini.

4. **UI Dashboard & Sidebar (`app/page.tsx`)**
   Dashboard utama sepenuhnya terpusat di `page.tsx`. Jika Anda ingin menambahkan menu navigasi baru, mengganti ikon, atau mengubah struktur *layout*, Anda cukup merombak file ini.

5. **Logika Sinkronisasi WhatsApp API (`lib/whatsapp.ts`)**
   File ini menangani proses HTTP *request* pengiriman teks dan gambar ke WhatsApp Meta. Jika Anda ingin mendukung pesan interaktif (seperti *Buttons* atau *List Messages* khas WhatsApp), tambahkan fungsinya di sini!

6. **Format Download Backup (`app/api/backups/route.ts`)**
   Fitur unduh *backup* otomatis mencetak ke CSV. Jika Anda ingin mengganti *header* CSV atau memodifikasinya agar terunduh dalam format PDF/JSON, silakan ubah pada file API ini.

---
*Built with ❤️ for a smarter, automated customer service experience.*
