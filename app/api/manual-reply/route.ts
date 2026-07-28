import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, sendWhatsAppImage, uploadMedia } from "@/lib/whatsapp";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const phone_number = formData.get("phone_number") as string;
    const content = formData.get("content") as string;
    const imageFile = formData.get("image") as File | null;

    if (!phone_number) {
      return NextResponse.json({ message: "Missing phone_number" }, { status: 400 });
    }

    let finalContent = content || "";

    if (imageFile) {
      // 1. Upload media to WhatsApp
      const mediaId = await uploadMedia(imageFile, imageFile.type);
      
      // 2. Send image message via WhatsApp
      await sendWhatsAppImage(phone_number, mediaId, finalContent, false);
      
      // 3. Format database content so admin sees the image too
      finalContent = `[IMAGE:${mediaId}] ${finalContent}`.trim();
    } else {
      if (!content) return NextResponse.json({ message: "Missing content" }, { status: 400 });
      // 1. Send text message to WhatsApp
      await sendWhatsAppMessage(phone_number, content);
    }

    // 2. Save message to Supabase as 'admin'
    const { error: dbError } = await supabase.from("messages").insert({
      phone_number: phone_number,
      role: "admin",
      content: finalContent,
    });

    if (dbError) {
      console.error("Supabase Error:", dbError);
      return NextResponse.json({ message: "Failed to save to database", error: dbError }, { status: 500 });
    }

    // 3. Update last_active in sessions
    await supabase.from("sessions").update({ last_active: new Date().toISOString() }).eq("phone_number", phone_number);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Manual Reply Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
