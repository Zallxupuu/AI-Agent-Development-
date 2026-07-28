import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseClient } from "@/lib/supabase-client";
import { Save, Loader2, Settings, UploadCloud, X, LinkIcon, Megaphone, User, Bot, MessageSquare } from "@/components/Icons";
import type { AiConfig } from "@/lib/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'profil' | 'ai' | 'training' | 'interaktif' | 'pembayaran'>('profil');

  // Training Data State
  const [trainingData, setTrainingData] = useState("");

  // Promo State
  const [promoActive, setPromoActive] = useState(false);
  const [promoEndDate, setPromoEndDate] = useState("");
  const [promoText, setPromoText] = useState("");

  // Interactive Buttons State
  const [btnActive, setBtnActive] = useState(true);
  const [btn1, setBtn1] = useState("Lihat Produk");
  const [btn2, setBtn2] = useState("Cara Beli");
  const [btn3, setBtn3] = useState("Hubungi Admin");
  
  // Link Button State
  const [linkBtnActive, setLinkBtnActive] = useState(true);
  const [linkBtnLabel, setLinkBtnLabel] = useState("Kunjungi Website");
  const [linkBtnUrl, setLinkBtnUrl] = useState("");
  
  // Feedback Button State
  const [fbBtnActive, setFbBtnActive] = useState(true);
  const [fbBtnLabel, setFbBtnLabel] = useState("Beri Ulasan");
  const [fbBtnUrl, setFbBtnUrl] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseClient
          .from("ai_config")
          .select("*")
          .eq("id", 1)
          .single();

        if (error) {
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
          setConfig(data as AiConfig);
          
          if (data?.products) {
            try {
              const promo = JSON.parse(data.products);
              setPromoActive(promo.active || false);
              setPromoEndDate(promo.endDate || "");
              setPromoText(promo.text || "");
              setTrainingData(promo.trainingData || "");
              
              if (promo.interactive) {
                setBtnActive(promo.interactive.enabled ?? true);
                setBtn1(promo.interactive.btn1 || "Lihat Produk");
                setBtn2(promo.interactive.btn2 || "Cara Beli");
                setBtn3(promo.interactive.btn3 || "Hubungi Admin");
                
                setLinkBtnActive(promo.interactive.linkEnabled ?? true);
                setLinkBtnLabel(promo.interactive.linkLabel || "Kunjungi Website");
                setLinkBtnUrl(promo.interactive.linkUrl || "");
                
                setFbBtnActive(promo.interactive.fbEnabled ?? true);
                setFbBtnLabel(promo.interactive.fbLabel || "Beri Ulasan");
                setFbBtnUrl(promo.interactive.fbUrl || "");
              }
            } catch (e) {
              // Not JSON, ignore
            }
          }
        }
      } catch (err: any) {
        console.error("Error fetching config:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      const promoData = {
        active: promoActive,
        endDate: promoEndDate,
        text: promoText,
        trainingData,
        interactive: {
          enabled: btnActive,
          btn1, btn2, btn3,
          linkEnabled: linkBtnActive,
          linkLabel: linkBtnLabel,
          linkUrl: linkBtnUrl,
          fbEnabled: fbBtnActive,
          fbLabel: fbBtnLabel,
          fbUrl: fbBtnUrl
        }
      };

      const { error } = await supabaseClient.from("ai_config").upsert({
        id: 1,
        business_name: config.business_name,
        business_description: config.business_description,
        products: JSON.stringify(promoData),
        rules: config.rules,
        store_url: config.store_url,
        qris_url: config.qris_url,
        profile_url: config.profile_url,
        payment_format: config.payment_format,
      });

      if (error) throw error;
      setMessage({ type: "success", text: "Pengaturan berhasil disimpan!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error("Error saving config:", err);
      setMessage({ type: "error", text: "Gagal menyimpan pengaturan." });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("ai-agent-storage")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseClient.storage
      .from("ai-agent-storage")
      .getPublicUrl(filePath);

    return publicUrl;
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
      setMessage({ type: "success", text: "Gambar Profil Toko berhasil diunggah! Jangan lupa klik Simpan Pengaturan." });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: "Gagal mengunggah gambar." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'profil', label: 'Profil Bisnis', icon: <User size={18} /> },
    { id: 'ai', label: 'Preferensi AI', icon: <Bot size={18} /> },
    { id: 'training', label: 'Training & FAQ', icon: <MessageSquare size={18} /> },
    { id: 'interaktif', label: 'Tombol & Promo', icon: <Megaphone size={18} /> },
    { id: 'pembayaran', label: 'Link & Payment', icon: <LinkIcon size={18} /> },
  ];

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-card w-full max-w-5xl h-[95vh] sm:h-[85vh] rounded-3xl shadow-2xl border border-border flex flex-col md:flex-row overflow-hidden relative"
          onClick={e => e.stopPropagation()}
        >
          {/* Close Button Mobile */}
          <button onClick={onClose} className="md:hidden absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground z-20">
            <X size={20} />
          </button>

          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 bg-muted/30 border-b md:border-b-0 md:border-r border-border flex flex-col">
            <div className="p-6 pb-4 border-b border-border hidden md:block">
              <h2 className="font-bold text-xl text-foreground flex items-center gap-2">
                <Settings size={22} className="text-primary" /> Pengaturan AI
              </h2>
            </div>
            
            <div className="flex-1 overflow-x-auto md:overflow-y-auto p-4 flex md:flex-col gap-2 scrollbar-none">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all min-w-max md:min-w-0 ${
                    activeTab === tab.id 
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Close Button Desktop */}
            <button onClick={onClose} className="hidden md:block absolute top-6 right-6 p-2 rounded-full hover:bg-muted text-muted-foreground z-20 transition-colors">
              <X size={20} />
            </button>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="animate-spin mb-4 text-primary" size={32} />
                <p>Memuat Pengaturan...</p>
              </div>
            ) : (
              <form onSubmit={saveSettings} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin">
                  
                  {/* TAB 1: PROFIL BISNIS */}
                  {activeTab === 'profil' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-2xl">
                      <h3 className="text-lg font-bold text-foreground mb-6 border-b border-border pb-4">Profil & Identitas Bisnis</h3>
                      
                      <div>
                        <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Nama Bisnis / Toko</label>
                        <input
                          type="text"
                          value={config?.business_name || ""}
                          onChange={(e) => setConfig(prev => prev ? { ...prev, business_name: e.target.value } : null)}
                          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-[15px] shadow-sm"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Deskripsi Bisnis / Katalog Produk</label>
                        <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Jelaskan bisnismu, harga produk, atau layanan yang ditawarkan secara detail agar AI mengerti.</p>
                        <textarea
                          value={config?.business_description || ""}
                          onChange={(e) => setConfig(prev => prev ? { ...prev, business_description: e.target.value } : null)}
                          rows={8}
                          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] shadow-sm font-mono text-sm"
                          required
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 2: PREFERENSI AI */}
                  {activeTab === 'ai' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-2xl">
                      <h3 className="text-lg font-bold text-foreground mb-6 border-b border-border pb-4">Gaya Bahasa & Aturan AI</h3>
                      
                      <div>
                        <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Instruksi Khusus (System Prompt)</label>
                        <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Beritahu AI bagaimana cara ia harus menjawab pelanggan (contoh: "Gunakan sapaan Kak, bahasa santai, jangan kaku").</p>
                        <textarea
                          value={config?.rules || ""}
                          onChange={(e) => setConfig(prev => prev ? { ...prev, rules: e.target.value } : null)}
                          rows={6}
                          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] shadow-sm"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 3: TRAINING AI */}
                  {activeTab === 'training' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-2xl">
                      <h3 className="text-lg font-bold text-foreground mb-6 border-b border-border pb-4">Knowledge Base & FAQ</h3>
                      
                      <div>
                        <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Data Latihan AI (FAQ / Format Pesanan)</label>
                        <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Masukkan pertanyaan yang sering ditanyakan (FAQ) atau format pesanan agar AI bisa memberikan respon yang tepat sesuai standar tokomu.</p>
                        <textarea
                          value={trainingData}
                          onChange={(e) => setTrainingData(e.target.value)}
                          rows={12}
                          placeholder="Contoh:&#10;Q: Apakah barang ready?&#10;A: Semua barang di etalase kami ready ya Kak!&#10;&#10;Format Pesanan:&#10;Nama:&#10;Alamat Lengkap:&#10;No HP:&#10;Pesanan:"
                          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] shadow-sm font-mono text-sm"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 4: INTERAKTIF */}
                  {activeTab === 'interaktif' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 max-w-2xl">
                      <h3 className="text-lg font-bold text-foreground mb-4 border-b border-border pb-4">Pengaturan Tombol & Promo</h3>

                      {/* Menu Buttons */}
                      <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-bold text-foreground">Tombol Menu WhatsApp (Interactive)</h4>
                            <p className="text-[13px] text-muted-foreground mt-0.5">Muncul ketika pelanggan mengetik "menu" atau bot merasa perlu.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={btnActive} onChange={(e) => setBtnActive(e.target.checked)} />
                            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                          </label>
                        </div>
                        {btnActive && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input type="text" value={btn1} onChange={e => setBtn1(e.target.value)} placeholder="Tombol 1" maxLength={20} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                            <input type="text" value={btn2} onChange={e => setBtn2(e.target.value)} placeholder="Tombol 2" maxLength={20} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                            <input type="text" value={btn3} onChange={e => setBtn3(e.target.value)} placeholder="Tombol 3" maxLength={20} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                          </div>
                        )}
                      </div>

                      {/* URL Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* URL Toko */}
                        <div className="bg-card border border-border p-5 rounded-2xl">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-foreground">Tombol URL Toko</h4>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={linkBtnActive} onChange={(e) => setLinkBtnActive(e.target.checked)} />
                              <div className="w-9 h-5 bg-border rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                          </div>
                          {linkBtnActive && (
                            <div className="space-y-3">
                              <input type="text" value={linkBtnLabel} onChange={e => setLinkBtnLabel(e.target.value)} placeholder="Label (ex: Kunjungi Website)" maxLength={20} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                              <input type="url" value={linkBtnUrl} onChange={e => setLinkBtnUrl(e.target.value)} placeholder="URL (https://...)" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                            </div>
                          )}
                        </div>

                        {/* URL Feedback */}
                        <div className="bg-card border border-border p-5 rounded-2xl">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-foreground">Tombol Feedback</h4>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={fbBtnActive} onChange={(e) => setFbBtnActive(e.target.checked)} />
                              <div className="w-9 h-5 bg-border rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                          </div>
                          {fbBtnActive && (
                            <div className="space-y-3">
                              <input type="text" value={fbBtnLabel} onChange={e => setFbBtnLabel(e.target.value)} placeholder="Label (ex: Beri Ulasan)" maxLength={20} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                              <input type="url" value={fbBtnUrl} onChange={e => setFbBtnUrl(e.target.value)} placeholder="URL Form (https://...)" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Promo Section */}
                      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                              <Megaphone size={16} />
                            </div>
                            <h4 className="font-bold text-foreground">Status Promo Aktif</h4>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={promoActive} onChange={(e) => setPromoActive(e.target.checked)} />
                            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                          </label>
                        </div>
                        
                        {promoActive && (
                          <div className="mt-4 p-4 border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-900/10 rounded-xl space-y-4">
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1">Berlaku Sampai Tanggal</label>
                              <input type="date" value={promoEndDate} onChange={e => setPromoEndDate(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1">Detail Promo (Untuk diinfokan AI)</label>
                              <textarea value={promoText} onChange={e => setPromoText(e.target.value)} rows={3} placeholder="Contoh: Diskon 20% untuk semua produk sepatu khusus hari ini." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 5: LINK & PAYMENT */}
                  {activeTab === 'pembayaran' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-2xl">
                      <h3 className="text-lg font-bold text-foreground mb-6 border-b border-border pb-4">Pengaturan Media & Pembayaran</h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Profile Image */}
                        <div>
                          <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Gambar Profil Toko</label>
                          <p className="text-xs text-muted-foreground mb-2">Ditampilkan jika pengguna meminta logo/foto toko.</p>
                          <input type="url" value={config?.profile_url || ""} onChange={(e) => setConfig(prev => prev ? { ...prev, profile_url: e.target.value } : null)} placeholder="URL Gambar Profil" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background outline-none text-[13px] mb-2" />
                          <div className="relative group">
                            <input type="file" accept="image/*" onChange={handleProfileUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                            <button type="button" disabled={uploading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-card text-foreground border border-border rounded-xl text-sm font-medium">
                              {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                              Upload Gambar
                            </button>
                          </div>
                          {config?.profile_url && <img src={config.profile_url} alt="Profile" className="mt-3 max-h-24 rounded-lg border border-border shadow-sm object-contain" />}
                        </div>

                        {/* QRIS Image */}
                        <div>
                          <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Gambar QRIS</label>
                          <p className="text-xs text-muted-foreground mb-2">Dikirim otomatis saat AI menagih pembayaran.</p>
                          <input type="url" value={config?.qris_url || ""} onChange={(e) => setConfig(prev => prev ? { ...prev, qris_url: e.target.value } : null)} placeholder="URL Gambar QRIS" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background outline-none text-[13px] mb-2" />
                          <div className="relative group">
                            <input type="file" accept="image/*" onChange={handleQrisUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                            <button type="button" disabled={uploading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-card text-foreground border border-border rounded-xl text-sm font-medium">
                              {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                              Upload QRIS
                            </button>
                          </div>
                          {config?.qris_url && <img src={config.qris_url} alt="QRIS" className="mt-3 max-h-24 rounded-lg border border-border shadow-sm object-contain" />}
                        </div>
                      </div>

                      <div className="pt-4">
                        <label className="block text-[13px] font-semibold text-foreground mb-1.5 uppercase tracking-wide">Format Pembayaran Lengkap</label>
                        <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">Detail rekening dan instruksi transfer.</p>
                        <textarea
                          value={config?.payment_format || ""}
                          onChange={(e) => setConfig(prev => prev ? { ...prev, payment_format: e.target.value } : null)}
                          rows={4}
                          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none text-[15px] font-mono shadow-sm"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Footer Save Button */}
                <div className="p-5 bg-card border-t border-border flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-10">
                  <div className="text-sm font-medium text-muted-foreground">
                    {saving ? "Menyimpan..." : "Perubahan belum disimpan"}
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-xl transition-colors disabled:opacity-70 shadow-lg shadow-primary/20"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Simpan Pengaturan
                  </button>
                </div>
              </form>
            )}

            {/* Notification Toast positioned inside modal */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={`absolute bottom-24 right-6 z-50 px-5 py-3 rounded-xl shadow-xl border text-[14px] font-medium flex items-center gap-2 ${
                    message.type === "success" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {message.type === "success" ? "✅" : "⚠️"} {message.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
