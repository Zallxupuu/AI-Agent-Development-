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
import { sendWhatsAppMessage } from "@/lib/whatsapp";
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
  if (waMessage.type !== "text" || !waMessage.text?.body) {
    console.log(`[Webhook] Pesan non-teks diabaikan.`);
    return;
  }

  const phoneNumber = waMessage.from;
  const messageContent = waMessage.text.body;

  let isBotActive = true; 

  const { data: existingSession, error: fetchSessionError } = await supabase
    .from("sessions")
    .select("is_bot_active")
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

  try {
    await sendWhatsAppMessage(phoneNumber, aiResponse);
  } catch (sendError) {
    console.error(`[Webhook] Gagal kirim balasan WA:`, sendError);
  }

  await supabase.from("messages").insert({
    phone_number: phoneNumber,
    role: "ai",
    content: aiResponse,
  });
}
