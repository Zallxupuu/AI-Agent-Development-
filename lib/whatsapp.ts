const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

if (!PHONE_NUMBER_ID) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID");
if (!ACCESS_TOKEN) throw new Error("Missing WHATSAPP_ACCESS_TOKEN");

const WA_API_URL = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<Response> {
  const response = await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[WhatsApp API Error] Status: ${response.status}, Body: ${errorBody}`);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  return response;
}
