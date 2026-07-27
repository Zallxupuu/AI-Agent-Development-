import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone_number, content } = body;

    if (!phone_number || !content) {
      return NextResponse.json({ message: "Missing phone_number or content" }, { status: 400 });
    }

    // 1. Kirim pesan ke WhatsApp API menggunakan fungsi bantuan
    await sendWhatsAppMessage(phone_number, content);

    // 2. Simpan pesan ke Supabase sebagai 'admin'
    const { error: dbError } = await supabase.from("messages").insert({
      phone_number: phone_number,
      role: "admin",
      content: content,
    });

    if (dbError) {
      console.error("Supabase Error:", dbError);
      return NextResponse.json({ message: "Failed to save to database", error: dbError }, { status: 500 });
    }

    // 3. Update last_active di tabel sessions
    await supabase.from("sessions").update({ last_active: new Date().toISOString() }).eq("phone_number", phone_number);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Manual Reply Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
