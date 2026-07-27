import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseClient } from "@/lib/supabase-client";
import { Package, Plus, Trash, Edit2, Loader2, X, UploadCloud, Save } from "@/components/Icons";
import type { Product } from "@/lib/types";

export default function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error && error.code !== "42P01") throw error; // Ignore if table doesn't exist yet
      setProducts(data || []);
    } catch (err: any) {
      console.error("Error fetching products:", err);
      // Don't show error if table just doesn't exist yet
      if (err.code !== "42P01") {
        setMessage({ type: "error", text: "Gagal memuat katalog produk." });
      }
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const resetForm = () => {
    setName("");
    setCategory("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setName(product.name);
    setCategory(product.category || "");
    setDescription(product.description || "");
    setPrice(product.price || "");
    setImageUrl(product.image_url || "");
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const uploadFile = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `product_${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('uploads')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage.from('uploads').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await uploadFile(file);
      setImageUrl(publicUrl);
    } catch (error) {
      showMessage("error", "Gagal mengunggah gambar.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const productData = {
        name,
        category,
        description,
        price,
        image_url: imageUrl,
      };

      if (editingId) {
        const { error } = await supabaseClient.from("products").update(productData).eq("id", editingId);
        if (error) throw error;
        showMessage("success", "Produk berhasil diperbarui!");
      } else {
        const { error } = await supabaseClient.from("products").insert([productData]);
        if (error) throw error;
        showMessage("success", "Produk berhasil ditambahkan!");
      }

      closeModal();
      fetchProducts();
    } catch (err: any) {
      console.error("Save product error:", err);
      showMessage("error", "Gagal menyimpan produk. Pastikan tabel 'products' sudah dibuat.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus produk ini?")) return;
    try {
      const { error } = await supabaseClient.from("products").delete().eq("id", id);
      if (error) throw error;
      showMessage("success", "Produk berhasil dihapus!");
      fetchProducts();
    } catch (err: any) {
      console.error("Delete product error:", err);
      showMessage("error", "Gagal menghapus produk.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mb-4 text-indigo-500" size={32} />
        <p>Memuat Katalog Produk...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/30 relative scrollbar-thin">
      <header className="h-16 px-6 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-indigo-600 font-semibold border border-indigo-100/50 shadow-sm">
            <Package size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 tracking-tight">Katalog Produk</h2>
            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{products.length} Produk Tersedia</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-[0_4px_14px_-6px_rgba(79,70,229,0.4)]"
        >
          <Plus size={16} />
          Tambah Produk
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 md:p-8">
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

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300">
              <Package size={48} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Katalog Masih Kosong</h3>
            <p className="text-gray-500 max-w-md mb-8">Anda belum menambahkan produk apa pun. Tambahkan produk sekarang agar AI bisa merekomendasikannya ke pelanggan.</p>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 font-medium rounded-xl transition-all shadow-sm"
            >
              <Plus size={18} />
              Tambah Produk Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow relative"
              >
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                  <button onClick={() => openEditModal(product)} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:text-indigo-600 flex items-center justify-center shadow-sm border border-gray-100">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-600 flex items-center justify-center shadow-sm border border-gray-100">
                    <Trash size={14} />
                  </button>
                </div>
                
                <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-50 relative">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <Package size={40} className="text-gray-300" />
                  )}
                </div>
                
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 text-[15px] truncate">{product.name}</h3>
                    {product.category && (
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                        {product.category}
                      </span>
                    )}
                  </div>
                  {product.price && <p className="text-indigo-600 font-bold text-[14px] mb-2">{product.price}</p>}
                  <p className="text-gray-500 text-[13px] line-clamp-2 leading-relaxed">{product.description || "Tidak ada deskripsi"}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tambah/Edit Produk */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Package size={18} className="text-indigo-600" />
                  {editingId ? "Edit Produk" : "Tambah Produk Baru"}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
                {/* Photo Upload Area */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden relative group hover:border-indigo-300 transition-colors">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <UploadCloud size={28} className="text-gray-400 mb-2 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-[11px] font-medium text-gray-500">Upload Foto</span>
                      </>
                    )}
                    
                    {uploading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin text-indigo-600" />
                      </div>
                    )}
                    
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    />
                  </div>
                  {imageUrl && (
                    <button 
                      type="button" 
                      onClick={() => setImageUrl("")} 
                      className="mt-2 text-[12px] font-medium text-red-500 hover:text-red-600"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Nama Produk <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Kopi Susu Gula Aren"
                      className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-[15px]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Kategori</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Contoh: Minuman"
                      className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-[15px]"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Harga</label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Contoh: Rp 25.000"
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-[15px]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Deskripsi</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan detail produk ini..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none text-[15px]"
                  />
                </div>
                
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 font-medium rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Simpan Produk
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
