import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const startIso = url.searchParams.get("start");
    const endIso = url.searchParams.get("end");

    if (!startIso || !endIso) {
      return NextResponse.json({ error: "Missing start or end query parameters" }, { status: 400 });
    }

    // Fetch messages within the specified date range
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages for backup:", error);
      return NextResponse.json({ error: "Gagal memuat pesan dari database." }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: "Tidak ada pesan pada periode ini." }, { status: 404 });
    }

    // Generate CSV Content
    // Headers
    const headers = ["ID", "No. Telepon", "Role", "Pesan", "Tanggal Waktu (UTC)"];
    
    // Escape CSV values
    const escapeCsv = (str: string) => {
      if (str === null || str === undefined) return '""';
      const cleanStr = String(str).replace(/"/g, '""');
      // Wrap in quotes if contains comma, newline, or quotes
      if (cleanStr.includes(',') || cleanStr.includes('\n') || cleanStr.includes('"')) {
        return `"${cleanStr}"`;
      }
      return cleanStr;
    };

    const csvRows = [headers.join(",")];
    
    for (const msg of messages) {
      const row = [
        msg.id,
        msg.phone_number,
        msg.role,
        msg.content,
        msg.created_at
      ].map(escapeCsv).join(",");
      csvRows.push(row);
    }

    const csvContent = csvRows.join("\n");

    // Format output filename
    const startDate = new Date(startIso).toISOString().split('T')[0];
    const endDate = new Date(endIso).toISOString().split('T')[0];
    const filename = `backup-chat-${startDate}-to-${endDate}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error("Backup generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
