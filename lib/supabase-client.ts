"use client";
/**
 * lib/supabase-client.ts
 * -----------------------
 * Inisialisasi Supabase Client untuk digunakan di Frontend (Browser).
 */

import { createClient } from "@supabase/supabase-js";

// Hardcoded langsung karena Next.js 16 Turbopack tidak meneruskan
// NEXT_PUBLIC_ env vars ke client bundle dengan benar.
export const supabaseClient = createClient(
  "https://ovaoduktzkbxjuwibgwv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92YW9kdWt0emtieGp1d2liZ3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMjAwNTUsImV4cCI6MjEwMDY5NjA1NX0.ihds8Zx44pmYtL4J-pvjvZcKbxkfAFkDzGINaMATQMQ"
);
