/**
 * app/api/webhook/route.ts
 * -------------------------
 * Webhook endpoint untuk Meta WhatsApp Cloud API.
 *
 * GET  → Verifikasi webhook (dipanggil oleh Meta saat setup webhook)
 * POST → Menerima pesan masuk dari WhatsApp dan memprosesnya
 */

import { type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppInteractiveButtons, sendWhatsAppInteractiveList, sendWhatsAppInteractiveUrl } from "@/lib/whatsapp";
import { getGeminiResponse } from "@/lib/gemini";
import { checkMLNickname } from "@/lib/nickname";
import type {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  Message,
} from "@/lib/types";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

if (!VERIFY_TOKEN) {
  throw new Error("Missing environment variable: WHATSAPP_VERIFY_TOKEN");
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (!mode || !token || !challenge) {
      console.warn("[Webhook GET] Parameter verifikasi tidak lengkap.");
      return new Response("Missing verification parameters", { status: 400 });
    }

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Webhook GET] ✅ Webhook berhasil diverifikasi.");
      return new Response(challenge, { status: 200 });
    }

    console.warn("[Webhook GET] ❌ Verify token tidak cocok.");
    return new Response("Forbidden: Invalid verify token", { status: 403 });
  } catch (error) {
    console.error("[Webhook GET] Error:", error);
    return Response.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// Simpan ID pesan yang sudah diproses di memori untuk deduplikasi cepat
const processedMessageIds = new Set<string>();
// Bersihkan cache setiap jam agar memori tidak bocor
setInterval(() => processedMessageIds.clear(), 60 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    const body: WhatsAppWebhookPayload = await req.json();

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        const changes = entry.changes;
        for (const change of changes) {
          const value = change.value;
          if (value.messages && value.messages.length > 0) {
            for (const waMessage of value.messages) {
              // Deduplikasi: Cegah pesan diproses dua kali (menghindari double chat)
              if (waMessage.id && processedMessageIds.has(waMessage.id)) {
                console.log(`[Webhook] Pesan ${waMessage.id} sudah diproses, mengabaikan duplikat.`);
                continue;
              }
              if (waMessage.id) {
                processedMessageIds.add(waMessage.id);
              }

              // Jalankan secara asynchronous (tanpa await) agar webhook membalas 200 OK 
              // ke WhatsApp dalam hitungan milidetik. Mencegah delay & pengiriman ulang dari Meta.
              processIncomingMessage(waMessage).catch((err) => 
                console.error("[Webhook] Error background processing:", err)
              );
            }
          }
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("[Webhook POST] Error:", error);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}

async function processIncomingMessage(
  waMessage: WhatsAppMessage
): Promise<void> {
  let messageContent = "";
  if (waMessage.type === "text" && waMessage.text?.body) {
    messageContent = waMessage.text.body;
  } else if (waMessage.type === "image" && waMessage.image?.id) {
    const caption = waMessage.image.caption ? ` Caption: ${waMessage.image.caption}` : "";
    messageContent = `[Pelanggan mengirim gambar/foto bukti] [IMAGE:${waMessage.image.id}]${caption}`;
  } else if (waMessage.type === "interactive" && waMessage.interactive) {
    if (waMessage.interactive.type === "button_reply") {
      messageContent = waMessage.interactive.button_reply?.title || "";
    } else if (waMessage.interactive.type === "list_reply") {
      messageContent = waMessage.interactive.list_reply?.title || "";
    }
    
    if (!messageContent) {
      console.log(`[Webhook] Tipe interactive tidak dikenali.`);
      return;
    }
  } else {
    console.log(`[Webhook] Pesan tipe ${waMessage.type} diabaikan.`);
    return;
  }

  // INTERCEPT: Auto-Cek Nickname MLBB
  // Regex mencari format: angka 5-12 digit, spasi/kurung/strip, angka 4-5 digit
  // Contoh: 1114917746 (13486) atau 1114917746 13486
  const mlbbRegex = /\b(\d{5,12})\s*[\(\-\s]?\s*(\d{4,5})[\)\-\s]?\b/;
  const match = messageContent.match(mlbbRegex);
  if (match) {
    const userId = match[1];
    const zoneId = match[2];
    const nickname = await checkMLNickname(userId, zoneId);
    if (nickname) {
      messageContent += `\n\n[SYSTEM INFO: Sistem telah mengecek ID Game secara otomatis ke server. Nickname in-game untuk ID ${userId} (${zoneId}) adalah "${nickname}". Informasikan nama ini ke pengguna untuk mengonfirmasi pesanan mereka.]`;
    } else {
      messageContent += `\n\n[SYSTEM INFO: Sistem mencoba mengecek ID ${userId} (${zoneId}) tetapi tidak ditemukan (invalid). Beritahu pengguna bahwa ID salah.]`;
    }
  }

  const phoneNumber = waMessage.from;

  let isBotActive = true; 
  let currentStatus = "new";

  const { data: existingSession, error: fetchSessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (fetchSessionError && fetchSessionError.code === "PGRST116") {
    const { error: insertSessionError } = await supabase
      .from("sessions")
      .insert({
        phone_number: phoneNumber,
        is_bot_active: true,
        last_active: new Date().toISOString(),
      });

    if (insertSessionError) {
      console.error("[Webhook] Error insert session:", insertSessionError);
      return;
    }
  } else if (fetchSessionError) {
    console.error("[Webhook] Error fetch session:", fetchSessionError);
    return;
  } else if (existingSession) {
    isBotActive = existingSession.is_bot_active;
    currentStatus = existingSession.status || "new";
    await supabase
      .from("sessions")
      .update({ last_active: new Date().toISOString() })
      .eq("phone_number", phoneNumber);
  }

  const { error: insertMsgError } = await supabase.from("messages").insert({
    phone_number: phoneNumber,
    role: "client",
    content: messageContent,
  });

  if (insertMsgError) {
    console.error("[Webhook] Error insert message:", insertMsgError);
    return;
  }

  if (!isBotActive) {
    return;
  }

  const { data: chatHistory, error: historyError } = await supabase
    .from("messages")
    .select("*")
    .eq("phone_number", phoneNumber)
    .order("created_at", { ascending: true })
    .limit(5);

  if (historyError) {
    console.error("[Webhook] Error fetch chat history:", historyError);
    return;
  }

  const typedHistory: Message[] = (chatHistory as Message[]) || [];
  const aiResponse = await getGeminiResponse(typedHistory, messageContent);

  let textToSend = aiResponse;

  // Extract Mood, Lang, and Payment
  const moodMatch = textToSend.match(/\[MOOD:(.*?)\]/i);
  const langMatch = textToSend.match(/\[LANG:(.*?)\]/i);
  
  // Deteksi pembayaran ganda: lewat AI (PAYMENT_CLAIMED), lewat Gambar (semua gambar dianggap butuh admin), atau Regex kata kunci
  const paymentMatch = 
    textToSend.includes("[PAYMENT_CLAIMED]") || 
    messageContent.includes("[IMAGE:") || 
    /transfer|udah bayar|sudah bayar|lunas|tf|struk|bukti/i.test(messageContent);
  
  const mood = moodMatch ? moodMatch[1].toLowerCase() : null;
  const lang = langMatch ? langMatch[1].toLowerCase() : null;
  
  if (moodMatch) textToSend = textToSend.replace(moodMatch[0], "").trim();
  if (langMatch) textToSend = textToSend.replace(langMatch[0], "").trim();
  if (paymentMatch) textToSend = textToSend.replace(/\[PAYMENT_CLAIMED\]/gi, "").trim();

  if (mood || lang || paymentMatch) {
    const parts = currentStatus.split('|');
    let baseStatus = parts[0] || 'new';
    const currentMood = parts[1] || 'neutral';
    const currentLang = parts[2] || 'id';
    let currentPayment = parts[3] || 'unpaid';

    if (paymentMatch) {
      currentPayment = 'claimed';
      baseStatus = 'pending'; // Force pending to get admin attention
    }
    
    currentStatus = `${baseStatus}|${mood || currentMood}|${lang || currentLang}|${currentPayment}`;
    
    const updateData: any = { status: currentStatus };
    if (paymentMatch) {
      updateData.is_bot_active = false; // Turn off bot so it doesn't auto-reply while waiting for confirmation
    }
    
    await supabase.from("sessions").update(updateData).eq("phone_number", phoneNumber);
  }
  
  // Handle switch to manual reply
  const needsManualReply = textToSend.includes("[MANUAL_REPLY]");
  if (needsManualReply) {
    textToSend = textToSend.replace(/\[MANUAL_REPLY\]/g, "").trim();
    
    const parts = currentStatus.split('|');
    const newStatus = `pending|${parts[1] || 'neutral'}|${parts[2] || 'id'}|${parts[3] || 'unpaid'}`;
    
    // Nonaktifkan bot dan set status pending agar disorot admin
    await supabase
      .from("sessions")
      .update({ is_bot_active: false, status: newStatus })
      .eq("phone_number", phoneNumber);
  }

  const needsQris = textToSend.includes("[QRIS]");
  if (needsQris) {
    textToSend = textToSend.replace(/\[QRIS\]/g, "").trim();
  }

  const needsMenu = textToSend.includes("[MENU]");
  if (needsMenu) {
    textToSend = textToSend.replace(/\[MENU\]/g, "").trim();
  }

  const needsLink = textToSend.includes("[LINK]");
  if (needsLink) {
    textToSend = textToSend.replace(/\[LINK\]/g, "").trim();
  }

  const needsKatalog = textToSend.includes("[KATALOG]");
  if (needsKatalog) {
    textToSend = textToSend.replace(/\[KATALOG\]/g, "").trim();
  }

  const needsFeedback = textToSend.includes("[FEEDBACK]");
  if (needsFeedback) {
    textToSend = textToSend.replace(/\[FEEDBACK\]/g, "").trim();
  }

  const needsProfileImg = textToSend.includes("[GAMBAR_TOKO]");
  if (needsProfileImg) {
    textToSend = textToSend.replace(/\[GAMBAR_TOKO\]/g, "").trim();
  }

  try {
    let aiConfig = null;
    if (needsMenu || needsLink || needsFeedback) {
      const { data } = await supabase.from("ai_config").select("products").eq("id", 1).single();
      aiConfig = data;
    }

    if (needsMenu) {
      let btn1 = "Lihat Produk", btn2 = "Cara Beli", btn3 = "Hubungi Admin";
      let btnActive = true;
      if (aiConfig?.products) {
        try {
          const promo = JSON.parse(aiConfig.products);
          if (promo.interactive) {
             btnActive = promo.interactive.enabled ?? true;
             btn1 = promo.interactive.btn1 || btn1;
             btn2 = promo.interactive.btn2 || btn2;
             btn3 = promo.interactive.btn3 || btn3;
          }
        } catch (e) {}
      }
      
      if (btnActive) {
        await sendWhatsAppInteractiveButtons(phoneNumber, textToSend || "Silakan pilih opsi berikut:", [
          { id: "btn_katalog", title: btn1.substring(0, 20) },
          { id: "btn_cara_beli", title: btn2.substring(0, 20) },
          { id: "btn_admin", title: btn3.substring(0, 20) }
        ]);
      } else {
        await sendWhatsAppMessage(phoneNumber, textToSend);
      }
    } else if (needsLink) {
      let linkLabel = "Kunjungi Website", linkUrl = "https://example.com";
      let linkActive = true;
      if (aiConfig?.products) {
        try {
          const promo = JSON.parse(aiConfig.products);
          if (promo.interactive) {
             linkActive = promo.interactive.linkEnabled ?? true;
             linkLabel = promo.interactive.linkLabel || linkLabel;
             linkUrl = promo.interactive.linkUrl || linkUrl;
          }
        } catch (e) {}
      }
      
      if (linkActive && linkUrl) {
        await sendWhatsAppInteractiveUrl(phoneNumber, textToSend || "Berikut link yang Anda minta:", linkLabel.substring(0, 20), linkUrl);
      } else {
        await sendWhatsAppMessage(phoneNumber, textToSend);
      }
    } else if (needsFeedback) {
      let fbLabel = "Beri Ulasan", fbUrl = "https://forms.gle/";
      let fbActive = true;
      if (aiConfig?.products) {
        try {
          const promo = JSON.parse(aiConfig.products);
          if (promo.interactive) {
             fbActive = promo.interactive.fbEnabled ?? true;
             fbLabel = promo.interactive.fbLabel || fbLabel;
             fbUrl = promo.interactive.fbUrl || fbUrl;
          }
        } catch (e) {}
      }
      
      if (fbActive && fbUrl) {
        await sendWhatsAppInteractiveUrl(phoneNumber, textToSend || "Berikut form untuk ulasan:", fbLabel.substring(0, 20), fbUrl);
      } else {
        await sendWhatsAppMessage(phoneNumber, textToSend);
      }
    } else if (needsKatalog) {
      // Ambil 10 produk teratas dari database
      const { data: products } = await supabase.from("products").select("id, name, price").limit(10);
      
      if (products && products.length > 0) {
        const rows = products.map(p => ({
          id: `prod_${p.id}`,
          title: p.name.substring(0, 24), // API limit: 24 chars for title
          description: `Rp ${Number(p.price).toLocaleString('id-ID')}`
        }));
        
        await sendWhatsAppInteractiveList(
          phoneNumber,
          textToSend || "Berikut adalah daftar produk kami:",
          "Pilih Produk",
          [{ title: "Katalog Produk", rows: rows }]
        );
      } else {
        await sendWhatsAppMessage(phoneNumber, textToSend + "\n\n(Katalog sedang kosong)");
      }
    } else {
      await sendWhatsAppMessage(phoneNumber, textToSend);
    }

    if (needsQris) {
      const { data: config } = await supabase.from("ai_config").select("qris_url").eq("id", 1).single();
      if (config?.qris_url) {
        await sendWhatsAppImage(phoneNumber, config.qris_url, "Silakan scan QRIS di atas untuk pembayaran.", true);
      }
    }

    if (needsProfileImg) {
      const { data: config } = await supabase.from("ai_config").select("profile_url").eq("id", 1).single();
      if (config?.profile_url) {
        await sendWhatsAppImage(phoneNumber, config.profile_url, "Berikut adalah foto/logo toko kami.", true);
      }
    }
  } catch (sendError) {
    console.error(`[Webhook] Gagal kirim balasan WA:`, sendError);
  }

  await supabase.from("messages").insert({
    phone_number: phoneNumber,
    role: "ai",
    content: textToSend,
  });
}
