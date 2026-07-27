import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseClient } from "@/lib/supabase-client";
import { Save, Loader2, Settings, UploadCloud, ArrowLeft, LinkIcon, Megaphone, User } from "@/components/Icons";
import type { AiConfig } from "@/lib/types";

export default function SettingsView() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Promo State (Stored in config.products as JSON)
  const [promoActive, setPromoActive] = useState(false);
  const [promoEndDate, setPromoEndDate] = useState("");
  const [promoText, setPromoText] = useState("");

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
              profile_url: "",
            });
          } else {
            throw error;
          }
        } else {
          const configData = data as AiConfig;
          setConfig(configData);
          try {
            const promo = JSON.parse(configData.products || "{}");
            setPromoActive(promo.isActive || false);
            setPromoEndDate(promo.endDate || "");
            setPromoText(promo.promoText || "");
          } catch (e) {
            // If old text, just ignore
          }
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
      const promoObj = {
        isActive: promoActive,
        endDate: promoEndDate,
        promoText: promoText
      };
      const { error } = await supabaseClient
        .from("ai_config")
        .upsert({ ...config, products: JSON.stringify(promoObj), updated_at: new Date().toISOString() });

      if (error) throw error;
      setMessage({ type: "success", text: "Pengaturan AI berhasil disimpan!" });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error("Save error:", err);
      setMessage({ type: "error", text: "Gagal menyimpan pengaturan." });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabaseClient.storage
        .from('uploads')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const publicUrl = await uploadFile(file);
      setConfig(prev => prev ? { ...prev, qris_url: publicUrl } : null);
      setMessage({ type: "success", text: "Gambar QRIS berhasil diunggah! Jangan lupa klik Simpan Pengaturan." });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: "Gagal mengunggah gambar." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const publicUrl = await uploadFile(file);
      setConfig(prev => prev ? { ...prev, profile_url: publicUrl } : null);
      setMessage({ type: "success", text: "Foto profil berhasil diunggah! Jangan lupa klik Simpan Pengaturan." });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: "Gagal mengunggah gambar." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin mb-4 text-primary" size={32} />
        <p>Memuat Pengaturan...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background relative scrollbar-thin">
      <header className="h-16 px-6 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-semibold border border-primary/30 shadow-sm">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-foreground tracking-tight">Pengaturan AI</h2>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Workspace Settings</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg border text-[14px] font-medium flex items-center gap-2 ${
                message.type === "success" 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-500/10" 
                  : "bg-red-50 text-red-700 border-red-100 shadow-red-500/10"
              }`}
            >
              {message.type === "success" ? "✅" : "⚠️"}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSave} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            
            <div className="pb-6 border-b border-border">
              <h3 className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center"><User size={14} /></span>
                Profil Web & Toko
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Foto Profil Toko</label>
                  <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">Pilih gambar yang akan tampil sebagai avatar di pojok layar atau header chat.</p>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {config?.profile_url ? (
                        <img src={config.profile_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileUpload}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                      />
                      <button
                        type="button"
                        disabled={uploading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-card text-foreground border border-border group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:text-primary rounded-xl transition-all font-medium disabled:opacity-70 shadow-sm"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                        {uploading ? "Mengunggah..." : "Upload Foto"}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Nama Bisnis (Username)</label>
                  <input
                    type="text"
                    value={config?.business_name || ""}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, business_name: e.target.value } : null)}
                    placeholder="Contoh: Toko Kopi Senja"
                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-[15px] shadow-sm hover:border-primary/50"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Deskripsi Bisnis</label>
              <textarea
                value={config?.business_description || ""}
                onChange={(e) => setConfig(prev => prev ? { ...prev, business_description: e.target.value } : null)}
                placeholder="Jelaskan secara singkat bisnismu bergerak di bidang apa..."
                rows={3}
                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] shadow-sm hover:border-primary/50"
                required
              />
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-yellow-500/20 text-yellow-600 flex items-center justify-center"><Megaphone size={14} /></span>
                Promo Berbatas Waktu (Opsional)
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-xl">
                  <div>
                    <label className="block text-[14px] font-semibold text-foreground mb-1">Aktifkan Promo</label>
                    <p className="text-[12px] text-muted-foreground">Jika diaktifkan, AI akan menyertakan pesan promo saat pelanggan menanyakan produk.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={promoActive} onChange={(e) => setPromoActive(e.target.checked)} />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {promoActive && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6">
                    <div>
                      <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Berlaku Sampai (Tanggal)</label>
                      <input
                        type="date"
                        value={promoEndDate}
                        onChange={(e) => setPromoEndDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-[15px] shadow-sm hover:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Teks Template Promo</label>
                      <p className="text-[12px] text-muted-foreground mb-2 leading-relaxed">Format pesan promo yang akan dikirim. Boleh pakai harga coret (~Rp 50.000~), bintang tebal (*Rp 20.000*), dll.</p>
                      <textarea
                        value={promoText}
                        onChange={(e) => setPromoText(e.target.value)}
                        placeholder="📌Untuk produk X, kami sedang ada PROMO Bulan ini:&#10;Harga Normal: ~Rp 350.000~&#10;Harga PROMO cuman: *Rp 125.000*"
                        rows={5}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] shadow-sm hover:border-primary/50 font-mono text-sm"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Aturan Penjawab & Gaya Bahasa</label>
              <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Instruksi khusus untuk AI (misal: panggil pelanggan dengan sebutan 'Kak', jangan bahas kompetitor).</p>
              <textarea
                value={config?.rules || ""}
                onChange={(e) => setConfig(prev => prev ? { ...prev, rules: e.target.value } : null)}
                placeholder="Gunakan bahasa santai, asik, pakai emoji. Panggil pelanggan dengan sebutan 'Kak'. Jawab maksimal 2 paragraf pendek."
                rows={4}
                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] shadow-sm hover:border-primary/50"
              />
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center"><LinkIcon size={14} /></span>
                Pengaturan Link & Pembayaran
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">URL Web Toko</label>
                  <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Link website, Tokopedia, atau Shopee milikmu.</p>
                  <input
                    type="url"
                    value={config?.store_url || ""}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, store_url: e.target.value } : null)}
                    placeholder="Contoh: https://tokopedia.com/toko-senja"
                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-[15px] shadow-sm hover:border-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Gambar QRIS</label>
                  <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Pilih file dari komputer atau tempel link gambar (contoh: https://i.imgur.com/qris.jpg).</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      value={config?.qris_url || ""}
                      onChange={(e) => setConfig(prev => prev ? { ...prev, qris_url: e.target.value } : null)}
                      placeholder="URL Gambar QRIS"
                      className="flex-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-[15px] shadow-sm hover:border-primary/50"
                    />
                    
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrisUpload}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                      />
                      <button
                        type="button"
                        disabled={uploading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-card text-foreground border border-border group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:text-primary rounded-xl transition-all font-medium disabled:opacity-70 shadow-sm"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                        {uploading ? "Mengunggah..." : "Upload File"}
                      </button>
                    </div>
                  </div>
                  
                  {config?.qris_url && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Preview Gambar:</p>
                      <img src={config.qris_url} alt="QRIS Preview" className="max-h-32 rounded-lg border border-border shadow-sm" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Format Pembayaran Lengkap</label>
                  <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Detail rekening dan instruksi transfer.</p>
                  <textarea
                    value={config?.payment_format || ""}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, payment_format: e.target.value } : null)}
                    placeholder="BCA 123456789 a/n Budi&#10;Mandiri 987654321 a/n Budi&#10;Jika sudah transfer, mohon kirim bukti transfer ya kak!"
                    rows={4}
                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] shadow-sm hover:border-primary/50 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-primary/30"
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
