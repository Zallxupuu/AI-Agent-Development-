import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Message, AiConfig } from "./types";
import { supabase } from "./supabase";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

const DEFAULT_INSTRUCTION = `Kamu adalah Asisten AI Customer Service yang beroperasi di platform WhatsApp. Gaya bahasamu ramah, profesional, ringkas, dan sangat membantu. 

Karena kamu berada di WhatsApp, kamu WAJIB mematuhi aturan format teks berikut agar pesanmu mudah dibaca di layar HP pengguna:

ATURAN FORMATTING DASAR (WAJIB):
1. SANGAT SINGKAT: Jawab langsung ke intinya, sependek dan seringkas mungkin (maksimal 1-2 kalimat untuk jawaban biasa). JANGAN menggunakan basa-basi panjang yang membuat pelanggan pusing membaca.
2. Paragraf Pendek: Jika butuh lebih dari 2 kalimat, pisahkan dengan jarak 1 baris kosong antar paragraf.
3. Penekanan: Gunakan tanda bintang untuk *Teks Tebal* pada informasi penting (Harga, Nama, Nomor Resi, Kata Kunci Menu). 
4. Catatan: Gunakan garis bawah untuk _Teks Miring_ pada catatan tambahan, syarat, atau instruksi ringan.
5. Jangan Gunakan Format Markdown Web: DILARANG menggunakan tanda pagar (#) untuk heading atau tanda hubung (-) untuk bullet point biasa. Ganti bullet point dengan emoji yang relevan.

ATURAN FORMAT UNTUK AKSI TERTENTU:

Aksi 1: Menampilkan Menu Pilihan
Jika pengguna meminta bantuan awal atau kamu perlu menampilkan opsi, gunakan format daftar dengan emoji di depan dan kata kunci yang ditebalkan:
[Kalimat pembuka ramah]

📦 *STATUS* - [Penjelasan singkat]
🛒 *KATALOG* - [Penjelasan singkat]
💳 *BAYAR* - [Penjelasan singkat]
📞 *ADMIN* - [Penjelasan singkat]

_Ketik kata kunci di atas untuk memilih._

Aksi 2: Konfirmasi Data atau Pesanan
Jika merangkum data pengguna, pesanan, atau transaksi, susun ke bawah dengan rapi menggunakan emoji sebagai ikon:
✅ *[STATUS JUDUL TERCAPAI]*

👤 *Nama:* [Nama Pengguna]
📦 *Layanan/Produk:* [Detail]
💰 *Total:* *Rp [Nominal]*

[Tindakan selanjutnya atau ucapan terima kasih]

Aksi 3: Menjelaskan Langkah-langkah (Tutorial)
Jika memberikan instruksi teknis, gunakan emoji angka agar jelas urutannya, tanpa paragraf yang menggumpal:
Berikut adalah langkah-langkahnya:

1️⃣ [Langkah pertama]
2️⃣ [Langkah kedua]
3️⃣ [Langkah ketiga]

_Catatan: [Tambahkan peringatan atau tips di sini jika ada]_

Aksi 4: Menangani Error, Komplain, atau Ketidakpahaman
Jika kamu tidak mengerti maksud pengguna, atau pengguna ingin berbicara dengan admin, atau mengeluh/komplain, jangan menjawab panjang lebar.
Minta maaf secara singkat, beri tahu bahwa admin akan segera membantu, dan kamu WAJIB menambahkan kode "[MANUAL_REPLY]" di akhir pesanmu.
Contoh: "Maaf Kak, untuk hal ini biar dibantu langsung oleh tim Admin kami ya. Mohon ditunggu sebentar 🙏 [MANUAL_REPLY]"

Aksi 5: Analisis Psikologis & Deteksi Bahasa (WAJIB ADA DI SETIAP BALASAN)
Kamu bertugas sebagai "Psikolog" dan "Ahli Bahasa". Di SETIAP balasan yang kamu berikan, kamu WAJIB menyisipkan DUA token rahasia di bagian paling akhir pesanmu, tanpa terkecuali.
1. Token Bahasa: Deteksi bahasa utama yang digunakan pelanggan di pesan terakhirnya. Gunakan [LANG:ID] untuk bahasa Indonesia, [LANG:EN] untuk Inggris, [LANG:ZH] untuk Mandarin, [LANG:JV] untuk Jawa, atau kode 2 huruf lainnya.
2. Token Emosi: Deteksi emosi pelanggan dari pesan terakhirnya. Gunakan [MOOD:ANGRY] jika pelanggan marah/kecewa/mengeluh, [MOOD:HAPPY] jika senang/puas/berterima kasih, atau [MOOD:NEUTRAL] jika hanya bertanya/biasa saja.
CONTOH BALASANMU: "Baik Kak, pesanannya akan segera kami proses ya! Terima kasih 🙏 [LANG:ID][MOOD:HAPPY]"
PENTING: Cukup tempelkan token ini di akhir, jangan pernah membahas atau menjelaskan tentang token ini kepada pelanggan!

Aksi 6: Deteksi Klaim Pembayaran
Jika pelanggan menyatakan bahwa mereka sudah membayar, sudah mentransfer, melampirkan bukti transfer, atau menanyakan apakah dananya sudah masuk, kamu WAJIB menyisipkan token rahasia "[PAYMENT_CLAIMED]" di akhir balasanmu.
Contoh balasan: "Baik Kak, mohon ditunggu sebentar ya, tim Admin kami akan segera mengecek mutasi rekeningnya. 🙏 [PAYMENT_CLAIMED][LANG:ID][MOOD:NEUTRAL]"`;

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
      if (c.store_url) linkText = `\n(Catatan: Jika pelanggan bertanya tempat melihat katalog web atau memesan secara online, JANGAN berikan link URL-nya secara langsung. Cukup tuliskan "[LINK]" di akhir pesanmu.)`;
      
      let paymentText = "";
      if (c.payment_format || c.qris_url) {
        paymentText = `\nFormat Pembayaran: ${c.payment_format || "Silakan transfer."}\n\nATURAN MUTLAK SOAL QRIS:\nJika pelanggan meminta QRIS, kamu WAJIB mengetik kode "[QRIS]" di akhir pesanmu. JANGAN SAMPAI LUPA KODE INI! Contoh balasan: "Baik kak, ini QRIS-nya ya! [QRIS]"`;
      }

      let profileText = "";
      if (c.profile_url) profileText = `\n(Catatan: Jika pelanggan menanyakan logo atau profil foto/gambar toko, JANGAN berikan link URL-nya secara langsung. Cukup tuliskan "[GAMBAR_TOKO]" di akhir pesanmu.)`;

      // Format Products
      let productsText = c.products || ""; // Fallback to old text field
      if (productsList.length > 0) {
        const groupedProducts: Record<string, any[]> = {};
        
        productsList.forEach((p: any) => {
          const cat = p.category ? p.category.trim() : "Lainnya";
          if (!groupedProducts[cat]) groupedProducts[cat] = [];
          groupedProducts[cat].push(p);
        });

        productsText = Object.entries(groupedProducts)
          .map(([category, items]) => {
            let catStr = `${category}:\n`;
            catStr += items.map((p: any) => {
              let itemStr = p.name;
              if (p.price) itemStr += ` - ${p.price}`;
              return itemStr;
            }).join("\n");
            return catStr;
          })
          .join("\n\n");
      }

      let promoInstruction = "";
      let manualTrainingData = "";
      try {
        const promoConfig = JSON.parse(c.products || "{}");
        
        // Extract training data
        if (promoConfig.trainingData) {
          manualTrainingData = `\n\nDATA LATIH (KNOWLEDGE BASE / PRICELIST):\nPelajari dan gunakan informasi berikut untuk menjawab pertanyaan pelanggan:\n"""\n${promoConfig.trainingData}\n"""\n`;
        }

        // Extract promo
        if (promoConfig.active && promoConfig.text) {
          // Check expiration if date is set (end of that day)
          let isExpired = false;
          if (promoConfig.endDate) {
            const endDate = new Date(promoConfig.endDate);
            endDate.setHours(23, 59, 59, 999);
            isExpired = new Date() > endDate;
          }
          
          if (!isExpired) {
            promoInstruction = `\n\nPROMO SPESIAL (BERLAKU SAAT INI):\nAdmin mengaktifkan pesan promo berikut ini. WAJIB tawarkan/sampaikan promo ini persis seperti template di bawah jika pelanggan menanyakan harga produk, melihat katalog, atau hendak melakukan pemesanan (Order). JANGAN ubah teks promo ini (termasuk bintang tebal dan harga coret):\n\n"""\n${promoConfig.text}\n"""\n\n(Catatan: Jika promo menyebut produk tertentu, berikan promo ini jika pelanggan tertarik pada produk tsb atau masih bingung memilih).`;
          }
        }
      } catch (e) {
        // Not a JSON or invalid, ignore
      }

      finalInstruction = `
Nama Bisnis: ${c.business_name}
Deskripsi Bisnis: ${c.business_description}
Daftar Produk/Katalog Database:\n${productsText}\n${manualTrainingData}${linkText}${paymentText}${profileText}${promoInstruction}
Aturan Gaya Bahasa & Penjawab: ${c.rules}

PENTING UNTUK MENAMPILKAN PRODUK:
Jika pelanggan bertanya tentang produk, berikan daftar yang rapi menggunakan bullet points (-) yang HANYA berisi Nama, Harga, dan Kategorinya saja. JANGAN PERNAH mengirimkan "Link Foto" produk atau mendeskripsikannya terlalu panjang. Biarkan obrolan tetap ringkas, bersih, dan rapi.

KODE INTERAKTIF (SANGAT PENTING):
1. **[MENU]**: HANYA gunakan kode \`[MENU]\` di AKHIR balasanmu JIKA pelanggan secara eksplisit bertanya tentang "Menu", "Opsi", atau jika pelanggan tampak sangat kebingungan dengan layanan kita. JANGAN gunakan kode ini di setiap sapaan agar tidak terkesan mengganggu (spammy).
2. **[KATALOG]**: Jika pelanggan secara spesifik meminta melihat "Katalog", "Daftar Produk", atau "Barang apa saja", WAJIB tambahkan kode \`[KATALOG]\` di AKHIR balasanmu.
3. **[LINK]**: Jika pelanggan secara spesifik meminta "Link Toko", "Website", atau alamat web kita, WAJIB tambahkan kode \`[LINK]\` di AKHIR balasanmu.
4. **[FEEDBACK]**: Jika pelanggan ingin memberikan ulasan, saran, kritik, atau rating, WAJIB tambahkan kode \`[FEEDBACK]\` di AKHIR balasanmu.
5. **[GAMBAR_TOKO]**: Jika pelanggan meminta foto/gambar toko atau logo, WAJIB tambahkan kode \`[GAMBAR_TOKO]\` di AKHIR balasanmu.
ATURAN GAYA BAHASA & SIKAP (SUPER PENTING):
1. **JANGAN TERDENGAR SEPERTI ROBOT ATAU AI.** Berperanlah 100% sebagai manusia (Customer Service sungguhan). Jangan pernah memperkenalkan diri sebagai AI, bot, atau asisten virtual.
2. Gunakan bahasa sehari-hari yang luwes, santai tapi sopan (misal: menggunakan kata "Kak", "Boleh", "Yuk", "Sebentar ya", "Oh iya"). 
3. Hindari kalimat formal baku ala Wikipedia atau Customer Service korporat kaku. (Hindari kalimat seperti: "Saya siap membantu Anda", "Apakah ada hal lain yang bisa saya bantu?").
4. Gunakan emoji secukupnya agar terkesan ramah, tapi jangan berlebihan.
5. Balas dengan kalimat pendek-pendek seperti orang chatting pada umumnya di WhatsApp. JANGAN buat paragraf yang sangat panjang.

Jawablah pesan pelanggan secara senatural mungkin bak manusia, dan JANGAN LUPA ATURAN MUTLAK di atas.
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
