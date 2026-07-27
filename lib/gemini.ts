import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Message, AiConfig } from "./types";
import { supabase } from "./supabase";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

const DEFAULT_INSTRUCTION = `Kamu adalah asisten CS AI yang gaul, asik, ramah, dan sangat membantu.
1. Gunakan bahasa sehari-hari yang santai (seperti "aku", "kamu", "kak", "bro", dll) tapi tetap sopan.
2. Jangan kaku atau terlalu formal. Tambahkan emoji sesekali biar asik.
3. Jawab singkat, padat, dan jelas (maksimal 1-2 paragraf pendek).
4. Kalau tidak tahu, bilang saja dengan santai. Jangan bahas topik aneh/sensitif.`;

export async function getGeminiResponse(
  chatHistory: Message[],
  latestMessage: string
): Promise<string> {
  try {
    // 1. Fetch dynamic config and products
    const [configRes, productsRes] = await Promise.all([
      supabase.from("ai_config").select("*").eq("id", 1).single(),
      supabase.from("products").select("*").order("created_at", { ascending: true })
    ]);

    const { data: configData, error: configError } = configRes;
    const productsList = productsRes.data || [];

    let finalInstruction = DEFAULT_INSTRUCTION;
    if (configData && !configError) {
      const c = configData as AiConfig;
      
      let linkText = "";
      if (c.store_url) linkText = `\nLink Web/Toko: ${c.store_url} (Berikan link ini jika pelanggan bertanya tempat melihat katalog atau memesan secara online.)`;
      
      let paymentText = "";
      if (c.payment_format || c.qris_url) {
        paymentText = `\nFormat Pembayaran: ${c.payment_format || "Silakan transfer."}\n\nATURAN MUTLAK SOAL QRIS:\nJika pelanggan meminta QRIS, kamu WAJIB mengetik kode "[QRIS]" di akhir pesanmu. JANGAN SAMPAI LUPA KODE INI! Contoh balasan: "Baik kak, ini QRIS-nya ya! [QRIS]"`;
      }

      let profileText = "";
      if (c.profile_url) profileText = `\nURL Logo/Foto Profil Toko: ${c.profile_url} (Berikan link gambar ini jika pelanggan menanyakan logo atau profil toko kita.)`;

      // Format Products
      let productsText = c.products || ""; // Fallback to old text field
      if (productsList.length > 0) {
        productsText = productsList.map((p: any, index: number) => {
          let str = `${index + 1}. ${p.name}`;
          if (p.category) str += ` [Kategori: ${p.category}]`;
          if (p.price) str += ` - ${p.price}`;
          return str;
        }).join("\n");
      }

      finalInstruction = `
Nama Bisnis: ${c.business_name}
Deskripsi Bisnis: ${c.business_description}
Daftar Produk/Katalog:\n${productsText}\n${linkText}${paymentText}${profileText}
Aturan Gaya Bahasa & Penjawab: ${c.rules}

PENTING UNTUK MENAMPILKAN PRODUK:
Jika pelanggan bertanya tentang produk, berikan daftar yang rapi menggunakan bullet points (-) yang HANYA berisi Nama, Harga, dan Kategorinya saja. JANGAN PERNAH mengirimkan "Link Foto" produk atau mendeskripsikannya terlalu panjang. Biarkan obrolan tetap ringkas, bersih, dan rapi.

Kamu adalah AI Customer Service. Jawablah pesan pelanggan secara natural, dan JANGAN LUPA ATURAN MUTLAK di atas.
      `.trim();
    }

    const formattedHistory = chatHistory.map((msg) => ({
      role: msg.role === "client" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: `[System Instruction]: ${finalInstruction}` }] },
        { role: "model", parts: [{ text: "Baik, saya siap." }] },
        ...formattedHistory,
      ],
    });

    const result = await chat.sendMessage(latestMessage);
    const text = result.response.text();

    if (!text || text.trim().length === 0) return "Maaf, saya tidak dapat memproses.";
    return text;
  } catch (error) {
    console.error("[Gemini Error]:", error);
    return "Maaf, terjadi gangguan sistem. Tunggu admin kami.";
  }
}
