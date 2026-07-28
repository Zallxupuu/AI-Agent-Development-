import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!token) {
      return new Response("Missing token", { status: 500 });
    }

    // Step 1: Get the media URL
    const mediaRes = await fetch(`https://graph.facebook.com/v25.0/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!mediaRes.ok) {
      console.error("[Media API] Failed to fetch media URL:", await mediaRes.text());
      return new Response("Failed to fetch media info", { status: mediaRes.status });
    }

    const mediaData = await mediaRes.json();
    const mediaUrl = mediaData.url;
    const mimeType = mediaData.mime_type;

    if (!mediaUrl) {
      return new Response("Media URL not found", { status: 404 });
    }

    // Step 2: Download the binary image data
    const imageRes = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!imageRes.ok) {
      console.error("[Media API] Failed to download image binary");
      return new Response("Failed to download image", { status: imageRes.status });
    }

    const arrayBuffer = await imageRes.arrayBuffer();

    // Step 3: Return the image directly with the correct content type
    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[Media API] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
