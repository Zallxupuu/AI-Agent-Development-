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
import { sendWhatsAppMessage, sendWhatsAppImage } from "@/lib/whatsapp";
import { getGeminiResponse } from "@/lib/gemini";
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

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: WhatsAppWebhookPayload = await request.json();

    if (body.object !== "whatsapp_business_account") {
      return new Response("Not a WhatsApp webhook", { status: 404 });
    }

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        if (!value.messages || value.messages.length === 0) {
          continue;
        }

        for (const waMessage of value.messages) {
          await processIncomingMessage(waMessage);
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
  } else {
    console.log(`[Webhook] Pesan tipe ${waMessage.type} diabaikan.`);
    return;
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
  const paymentMatch = textToSend.includes("[PAYMENT_CLAIMED]");
  
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

  try {
    await sendWhatsAppMessage(phoneNumber, textToSend);

    if (needsQris) {
      const { data: config } = await supabase.from("ai_config").select("qris_url").eq("id", 1).single();
      if (config?.qris_url) {
        await sendWhatsAppImage(phoneNumber, config.qris_url, "Silakan scan QRIS di atas untuk pembayaran.");
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
