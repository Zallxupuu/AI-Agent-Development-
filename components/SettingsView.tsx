import React, { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase-client";
import { Save, Loader2, Settings, UploadCloud } from "lucide-react";
import type { AiConfig } from "@/lib/types";

export default function SettingsView() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabaseClient
          .from("ai_config")
          .select("*")
          .eq("id", 1)
          .single();

        if (error) {
          // If no row exists, we use a default structure
            if (error.code === "PGRST116") {
            setConfig({
              id: 1,
              business_name: "Bisnisku",
              business_description: "",
              products: "",
              rules: "Gunakan bahasa santai, gaul, asik.",
              store_url: "",
              qris_url: "",
              payment_format: "Silakan transfer ke rekening BCA 123456 a/n Bisnisku.",
            });
          } else {
            throw error;
          }
        } else {
          setConfig(data as AiConfig);
        }
      } catch (err: any) {
        console.error("Error fetching config:", err);
        setMessage({ type: "error", text: "Gagal memuat pengaturan AI." });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabaseClient
        .from("ai_config")
        .upsert({ ...config, updated_at: new Date().toISOString() });

      if (error) throw error;
      setMessage({ type: "success", text: "Pengaturan AI berhasil disimpan!" });
    } catch (err: any) {
      console.error("Save error:", err);
      setMessage({ type: "error", text: "Gagal menyimpan pengaturan." });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabaseClient.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setConfig(prev => prev ? { ...prev, qris_url: data.publicUrl } : null);
      setMessage({ type: "success", text: "Gambar berhasil diunggah! Jangan lupa klik Simpan Pengaturan." });
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage({ type: "error", text: "Gagal mengunggah gambar. Pastikan Anda sudah menjalankan SQL untuk storage." });
    } finally {
      setUploading(false);
      // Reset input value so same file can be uploaded again if needed
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mb-4 text-blue-500" size={32} />
        <p>Memuat Pengaturan...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/30 relative scrollbar-thin">
      <header className="h-16 px-6 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-indigo-600 font-semibold border border-indigo-100/50 shadow-[0_2px_10px_-4px_rgba(79,70,229,0.2)]">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 tracking-tight">Pengaturan AI</h2>
            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Workspace Settings</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 md:p-8">
        {message && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-medium border ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Nama Bisnis</label>
              <input
                type="text"
                value={config?.business_name || ""}
                onChange={(e) => setConfig(prev => prev ? { ...prev, business_name: e.target.value } : null)}
                placeholder="Contoh: Toko Kopi Senja"
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-[15px] shadow-sm hover:border-gray-300"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Deskripsi Bisnis</label>
              <textarea
                value={config?.business_description || ""}
                onChange={(e) => setConfig(prev => prev ? { ...prev, business_description: e.target.value } : null)}
                placeholder="Jelaskan secara singkat bisnismu bergerak di bidang apa..."
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none text-[15px] shadow-sm hover:border-gray-300"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Informasi Produk / Layanan</label>
              <p className="text-[13px] text-gray-500 mb-2 leading-relaxed">Sebutkan daftar produk, harga, jam buka, lokasi, atau promosi yang ada agar AI tahu.</p>
              <textarea
                value={config?.products || ""}
                onChange={(e) => setConfig(prev => prev ? { ...prev, products: e.target.value } : null)}
                placeholder="1. Kopi Susu Aren - Rp 15.000&#10;2. Croissant - Rp 25.000&#10;Jam buka: 08:00 - 22:00..."
                rows={6}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none text-[15px] shadow-sm hover:border-gray-300 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Aturan Penjawab & Gaya Bahasa</label>
              <p className="text-[13px] text-gray-500 mb-2 leading-relaxed">Instruksi khusus untuk AI (misal: panggil pelanggan dengan sebutan 'Kak', jangan bahas kompetitor).</p>
              <textarea
                value={config?.rules || ""}
                onChange={(e) => setConfig(prev => prev ? { ...prev, rules: e.target.value } : null)}
                placeholder="Gunakan bahasa santai, asik, pakai emoji. Panggil pelanggan dengan sebutan 'Kak'. Jawab maksimal 2 paragraf pendek."
                rows={4}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none text-[15px] shadow-sm hover:border-gray-300"
              />
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">🔗</span>
                Pengaturan Link & Pembayaran
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">URL Web Toko</label>
                  <p className="text-[13px] text-gray-500 mb-2 leading-relaxed">Link website, Tokopedia, atau Shopee milikmu.</p>
                  <input
                    type="url"
                    value={config?.store_url || ""}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, store_url: e.target.value } : null)}
                    placeholder="Contoh: https://tokopedia.com/toko-senja"
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-[15px] shadow-sm hover:border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Gambar QRIS</label>
                  <p className="text-[13px] text-gray-500 mb-2 leading-relaxed">Pilih file dari komputer atau tempel link gambar (contoh: https://i.imgur.com/qris.jpg).</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      value={config?.qris_url || ""}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, qris_url: e.target.value } : null)}
                      placeholder="URL Gambar QRIS"
                      className="flex-1 px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-[15px] shadow-sm hover:border-gray-300"
                    />
                    
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                      />
                      <button
                        type="button"
                        disabled={uploading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-200 group-hover:border-indigo-300 group-hover:bg-indigo-50 group-hover:text-indigo-700 rounded-xl transition-all font-medium disabled:opacity-70 shadow-sm"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                        {uploading ? "Mengunggah..." : "Upload File"}
                      </button>
                    </div>
                  </div>
                  
                  {config?.qris_url && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Preview Gambar:</p>
                      <img src={config.qris_url} alt="QRIS Preview" className="max-h-32 rounded-lg border border-gray-200 shadow-sm" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Format Pembayaran Lengkap</label>
                  <p className="text-[13px] text-gray-500 mb-2 leading-relaxed">Detail rekening dan instruksi transfer.</p>
                  <textarea
                    value={config?.payment_format || ""}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, payment_format: e.target.value } : null)}
                    placeholder="BCA 123456789 a/n Budi&#10;Mandiri 987654321 a/n Budi&#10;Jika sudah transfer, mohon kirim bukti transfer ya kak!"
                    rows={4}
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none text-[15px] shadow-sm hover:border-gray-300 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_14px_-6px_rgba(79,70,229,0.4)]"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
