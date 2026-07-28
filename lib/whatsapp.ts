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

export async function uploadMedia(file: File, type: string = "image/jpeg"): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  formData.append("messaging_product", "whatsapp");

  const response = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[WhatsApp API Error] Upload Media Status: ${response.status}, Body: ${errorBody}`);
    throw new Error(`WhatsApp API Media Upload error: ${response.status}`);
  }

  const data = await response.json();
  return data.id;
}

export async function sendWhatsAppImage(
  to: string,
  mediaIdOrUrl: string,
  caption?: string,
  isUrl: boolean = false
): Promise<Response> {
  const imagePayload = isUrl 
    ? { link: mediaIdOrUrl, caption: caption || "" }
    : { id: mediaIdOrUrl, caption: caption || "" };

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
      type: "image",
      image: imagePayload,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[WhatsApp API Error] Status: ${response.status}, Body: ${errorBody}`);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  return response;
}

export async function sendWhatsAppInteractiveButtons(
  to: string,
  text: string,
  buttons: { id: string; title: string }[]
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
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: text,
        },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: {
              id: btn.id,
              title: btn.title,
            },
          })),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[WhatsApp API Error] Interactive Buttons Status: ${response.status}, Body: ${errorBody}`);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  return response;
}

export async function sendWhatsAppInteractiveUrl(
  to: string,
  text: string,
  display_text: string,
  url: string
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
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: {
          text: text,
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: display_text,
            url: url,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[WhatsApp API Error] Interactive URL Status: ${response.status}, Body: ${errorBody}`);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  return response;
}

export async function sendWhatsAppInteractiveList(
  to: string,
  text: string,
  buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
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
      type: "interactive",
      interactive: {
        type: "list",
        header: {
          type: "text",
          text: "Katalog Produk",
        },
        body: {
          text: text,
        },
        action: {
          button: buttonText,
          sections: sections,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[WhatsApp API Error] Interactive List Status: ${response.status}, Body: ${errorBody}`);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  return response;
}
