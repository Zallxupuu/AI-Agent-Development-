import React, { useEffect, useState, useMemo } from "react";
import { supabaseClient } from "@/lib/supabase-client";
import { MessageSquare, User, Bot, AlertCircle, Clock, Loader2 } from "@/components/Icons";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeAi: 0,
    pendingOrders: 0,
    totalMessages: 0,
    aiMessagesToday: 0,
  });
  const [chartData, setChartData] = useState<{ date: string; pesan: number }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: sessions, error: sessionError } = await supabaseClient
          .from("sessions")
          .select("*");

        if (sessionError) throw sessionError;

        // Fetch messages from last 7 days for the chart
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const { data: messages, error: msgError } = await supabaseClient
          .from("messages")
          .select("created_at")
          .gte("created_at", sevenDaysAgo.toISOString());

        if (msgError) throw msgError;

        // Process chart data
        const groupedMap = new Map<string, number>();
        // Initialize last 7 days
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysAgo);
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          groupedMap.set(dateStr, 0);
        }

        messages?.forEach(msg => {
          const d = new Date(msg.created_at);
          const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          if (groupedMap.has(dateStr)) {
            groupedMap.set(dateStr, groupedMap.get(dateStr)! + 1);
          }
        });

        const formattedChartData = Array.from(groupedMap.entries()).map(([date, count]) => ({
          date,
          pesan: count
        }));

        setChartData(formattedChartData);

        const totalSessions = sessions?.length || 0;
        const activeAi = sessions?.filter((s) => s.is_bot_active).length || 0;
        const pendingOrders = sessions?.filter((s) => s.status === "pending").length || 0;

        // For total messages all time
        const { count: msgCount } = await supabaseClient
          .from("messages")
          .select("*", { count: "exact", head: true });

        // Fetch AI messages today to estimate API quota
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: aiMsgsToday } = await supabaseClient
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("role", "ai")
          .gte("created_at", today.toISOString());

        setStats({
          totalSessions,
          activeAi,
          pendingOrders,
          totalMessages: msgCount || 0,
          aiMessagesToday: aiMsgsToday || 0,
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
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-background/50 backdrop-blur-sm">
        <Loader2 className="animate-spin mb-2 text-primary" size={32} />
        <p>Memuat Statistik...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 md:p-8 scrollbar-thin">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Selamat Datang di Dashboard! 👋</h1>
          <p className="text-muted-foreground">Berikut adalah ringkasan performa asisten AI WhatsApp-mu saat ini.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1 */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <User size={24} />
            </div>
            <h3 className="text-3xl font-bold text-card-foreground mb-1">{stats.totalSessions}</h3>
            <p className="text-sm font-medium text-muted-foreground">Total Pelanggan</p>
          </div>

          {/* Card 2 */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-3xl font-bold text-card-foreground mb-1">{stats.totalMessages}</h3>
            <p className="text-sm font-medium text-muted-foreground">Total Pesan</p>
          </div>

          {/* Card 3 */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:border-primary/50 transition-colors relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
              <Bot size={24} />
            </div>
            <h3 className="text-3xl font-bold text-card-foreground mb-1">{stats.activeAi}</h3>
            <p className="text-sm font-medium text-muted-foreground">Sesi AI Aktif</p>
          </div>

          {/* Card 4 */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:border-primary/50 transition-colors relative">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-3xl font-bold text-card-foreground mb-1">{stats.pendingOrders}</h3>
            <p className="text-sm font-medium text-muted-foreground">Menunggu (Pending)</p>
            {stats.pendingOrders > 0 && (
              <div className="absolute top-4 right-4 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </div>
            )}
          </div>
        </div>

        {/* API Quota Progress Bar */}
        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border mb-8 hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Bot size={20} className="text-primary" />
              Kuota Harian API Gemini (Free Tier)
            </div>
            <span className="text-sm font-bold text-foreground">
              {stats.aiMessagesToday} / 1500 Respon
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 mb-2 overflow-hidden shadow-inner">
            <div 
              className={`h-3 rounded-full transition-all duration-1000 ${
                stats.aiMessagesToday > 1300 ? "bg-red-500" : stats.aiMessagesToday > 1000 ? "bg-yellow-500" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, (stats.aiMessagesToday / 1500) * 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-muted-foreground font-medium">
              Limit API 1500 request per hari (Rate limit gratis dari Google)
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              Sisa Kuota: {Math.max(0, 1500 - stats.aiMessagesToday)}
            </p>
          </div>
        </div>

        {/* Activity Chart Area */}
        <div className="bg-card p-6 md:p-8 rounded-3xl shadow-sm border border-border mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Aktivitas Pesan</h2>
              <p className="text-sm text-muted-foreground">Volume pesan masuk selama 7 hari terakhir.</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPesan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--card-foreground)', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="pesan" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorPesan)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
