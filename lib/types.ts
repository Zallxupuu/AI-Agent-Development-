/**
 * lib/types.ts
 * ----------------
 * Definisi TypeScript interfaces untuk seluruh aplikasi.
 * Semua tipe data yang berkaitan dengan database, WhatsApp API,
 * dan Gemini AI didefinisikan di sini agar kode tetap modular.
 */

// ==========================================
// Database Types (Supabase Tables)
// ==========================================

/** Representasi baris pada tabel `sessions` */
export interface Session {
  phone_number: string; // PK — nomor WA klien (format: 62xxx)
  is_bot_active: boolean; // true = AI menjawab otomatis, false = mode manual/admin
  last_active: string; // ISO 8601 timestamp terakhir interaksi
  status?: 'new' | 'pending' | 'done';
}

/** Role yang diizinkan pada tabel `messages` */
export type MessageRole = "client" | "ai" | "admin";

/** Representasi baris pada tabel `messages` */
export interface Message {
  id: string; // UUID, auto-generated oleh Supabase
  phone_number: string; // FK ke sessions.phone_number
  role: MessageRole; // Siapa yang mengirim pesan
  content: string; // Isi teks pesan
  created_at: string; // ISO 8601 timestamp
}

// ==========================================
// Meta WhatsApp Cloud API Types
// ==========================================

/** Struktur payload webhook dari Meta WhatsApp Cloud API */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: string;
}

export interface WhatsAppChangeValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: unknown[]; // Status updates (delivered, read, etc.) — kita abaikan
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppMessage {
  from: string; // Nomor pengirim (tanpa tanda +)
  id: string; // ID pesan unik dari WhatsApp
  timestamp: string;
  text?: {
    body: string; // Isi teks pesan
  };
  type: string; // "text", "image", "audio", dll.
}

// ==========================================
// Manual Reply Types (Admin Dashboard)
// ==========================================

/** Payload yang dikirim dari frontend saat admin membalas manual */
export interface ManualReplyPayload {
  phone_number: string; // Nomor WA tujuan
  content: string; // Isi pesan yang akan dikirim
}

// ==========================================
// API Response Types
// ==========================================

/** Format respons standar dari API backend */
export interface ApiResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

// ==========================================
// Settings / Configuration Types
// ==========================================

export interface AiConfig {
  id: number;
  business_name: string;
  business_description: string;
  products: string;
  rules: string;
  store_url?: string;
  qris_url?: string;
  payment_format?: string;
  profile_url?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  description?: string;
  price?: string;
  image_url?: string;
  created_at: string;
}
