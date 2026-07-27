import React, { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase-client";
import { MessageSquare, User, Bot, AlertCircle, Clock, Loader2 } from "@/components/Icons";

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeAi: 0,
    pendingOrders: 0,
    totalMessages: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: sessions, error: sessionError } = await supabaseClient
          .from("sessions")
          .select("*");

        if (sessionError) throw sessionError;

        const { count: msgCount, error: msgError } = await supabaseClient
          .from("messages")
          .select("*", { count: "exact", head: true });

        if (msgError) throw msgError;

        const totalSessions = sessions?.length || 0;
        const activeAi = sessions?.filter((s) => s.is_bot_active).length || 0;
        const pendingOrders = sessions?.filter((s) => s.status === "pending").length || 0;

        setStats({
          totalSessions,
          activeAi,
          pendingOrders,
          totalMessages: msgCount || 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white/50 backdrop-blur-sm">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Memuat Statistik...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] p-6 md:p-8 scrollbar-thin">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight mb-2">Selamat Datang di Dashboard! 👋</h1>
          <p className="text-gray-500">Berikut adalah ringkasan performa asisten AI WhatsApp-mu saat ini.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <User size={24} />
            </div>
            <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.totalSessions}</h3>
            <p className="text-sm font-medium text-gray-500">Total Pelanggan</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.totalMessages}</h3>
            <p className="text-sm font-medium text-gray-500">Total Pesan</p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Bot size={24} />
            </div>
            <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.activeAi}</h3>
            <p className="text-sm font-medium text-gray-500">Sesi AI Aktif</p>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-yellow-100 flex flex-col relative">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.pendingOrders}</h3>
            <p className="text-sm font-medium text-gray-500">Menunggu (Pending)</p>
            {stats.pendingOrders > 0 && (
              <div className="absolute top-4 right-4 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5 text-indigo-500">
            <Clock size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Pilih obrolan untuk memulai</h2>
          <p className="text-gray-500 max-w-sm mx-auto">Klik salah satu pelanggan di daftar sebelah kiri untuk membalas pesan, mengubah status, atau mematikan AI-nya.</p>
        </div>
      </div>
    </div>
  );
}
