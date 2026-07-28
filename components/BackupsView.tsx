"use client";

import React, { useEffect, useState } from "react";
import { Archive, Download, Loader2, AlertCircle } from "@/components/Icons";
import { supabaseClient } from "@/lib/supabase-client";

interface BackupInterval {
  id: string;
  startDate: Date;
  endDate: Date;
  label: string;
}

export default function BackupsView() {
  const [intervals, setIntervals] = useState<BackupInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOldestMessageDate = async () => {
      try {
        const { data, error } = await supabaseClient
          .from("messages")
          .select("created_at")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // No messages found
            setIntervals([]);
          } else {
            throw error;
          }
        } else if (data) {
          const oldestDate = new Date(data.created_at);
          const generatedIntervals = generateIntervals(oldestDate);
          setIntervals(generatedIntervals);
        }
      } catch (err: any) {
        console.error("Error fetching oldest message:", err);
        setError("Gagal memuat data backup.");
      } finally {
        setLoading(false);
      }
    };

    fetchOldestMessageDate();
  }, []);

  const generateIntervals = (startDate: Date): BackupInterval[] => {
    const intervals: BackupInterval[] = [];
    let currentStart = new Date(startDate);
    currentStart.setHours(0, 0, 0, 0); // Start of day

    const now = new Date();

    while (currentStart <= now) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 13); // 14 days interval (0 to 13)
      currentEnd.setHours(23, 59, 59, 999); // End of 14th day

      const endCap = currentEnd > now ? now : currentEnd;

      const formatOpt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      const startStr = currentStart.toLocaleDateString('id-ID', formatOpt);
      const endStr = endCap.toLocaleDateString('id-ID', formatOpt);

      intervals.unshift({
        id: `${currentStart.getTime()}-${currentEnd.getTime()}`,
        startDate: new Date(currentStart),
        endDate: new Date(endCap),
        label: `${startStr} - ${endStr}`,
      });

      // Move to next 14 days
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
      currentStart.setHours(0, 0, 0, 0);
    }

    return intervals; // Latest first
  };

  const handleDownload = (interval: BackupInterval) => {
    setDownloadingId(interval.id);
    
    const startIso = interval.startDate.toISOString();
    const endIso = interval.endDate.toISOString();
    
    // Redirect to API route to download CSV
    window.location.href = `/api/backups?start=${startIso}&end=${endIso}`;
    
    // Reset loading state after a brief moment since we can't detect when download finishes easily via window.location
    setTimeout(() => {
      setDownloadingId(null);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p>Memuat riwayat chat...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-2 rounded-lg text-primary">
          <Archive size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup Data Chat</h1>
          <p className="text-muted-foreground text-sm">Download riwayat pesan setiap 2 minggu.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2 mb-6">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {intervals.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center flex flex-col items-center justify-center shadow-sm">
          <Archive size={40} className="text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Belum ada Backup</h2>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm">
            Saat ini belum ada percakapan yang terekam di sistem, sehingga tidak ada data yang bisa didownload.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {intervals.map((interval, i) => (
            <div key={interval.id} className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/80 group-hover:bg-primary transition-colors" />
              <div className="flex justify-between items-start mb-4 pl-2">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Periode {intervals.length - i}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{interval.label}</p>
                </div>
                <div className="bg-muted text-muted-foreground rounded-full p-2">
                  <Archive size={16} />
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-border/50 pl-2">
                <button
                  onClick={() => handleDownload(interval)}
                  disabled={downloadingId === interval.id}
                  className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50"
                >
                  {downloadingId === interval.id ? (
                    <><Loader2 size={18} className="animate-spin" /> Menyiapkan...</>
                  ) : (
                    <><Download size={18} /> Download CSV</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
