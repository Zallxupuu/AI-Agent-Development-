"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseClient } from "@/lib/supabase-client";
import SettingsView from "@/components/SettingsView";
import ProductsView from "@/components/ProductsView";
import DashboardOverview from "@/components/DashboardOverview";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Session, Message, AiConfig } from "@/lib/types";
import { 
  Bot, 
  User, 
  Send, 
  MessageSquare, 
  BotOff, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Settings,
  ArrowLeft,
  Package,
  Tag,
  LayoutDashboard,
  Paperclip,
  X
} from "@/components/Icons";

const parseStatus = (statusStr: string | undefined) => {
  if (!statusStr) return { base: 'new', mood: 'neutral', lang: 'id', payment: 'unpaid' };
  const parts = statusStr.split('|');
  return {
    base: parts[0] || 'new',
    mood: parts[1] || 'neutral',
    lang: parts[2] || 'id',
    payment: parts[3] || 'unpaid'
  };
};

const getMoodEmoji = (mood: string) => {
  if (mood === 'angry') return '😡';
  if (mood === 'happy') return '😊';
  if (mood === 'neutral') return '😐';
  return '';
};

const getLangFlag = (lang: string) => {
  if (lang === 'en') return '🇬🇧';
  if (lang === 'zh') return '🇨🇳';
  if (lang === 'jv' || lang === 'su') return '🏝️';
  if (lang === 'id') return '🇮🇩';
  return '🇮🇩';
};

export default function Dashboard() {
  // State for Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // State for Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // State for Input & Sending
  const [inputValue, setInputValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch initial sessions & Subscribe to realtime
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { data, error } = await supabaseClient
          .from("sessions")
          .select("*")
          .order("last_active", { ascending: false });

        if (error) throw error;
        setSessions(data || []);
      } catch (err: any) {
        console.error("Error fetching sessions:", err);
        setError("Gagal memuat daftar chat.");
      } finally {
        setSessionsLoading(false);
      }
    };

    fetchSessions();

    // Realtime Subscription for Sessions
    const sessionsChannel = supabaseClient
      .channel("sessions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (payload) => {
          setSessions((prev) => {
            const newSession = payload.new as Session;
            const eventType = payload.eventType;

            if (eventType === "INSERT") {
              return [newSession, ...prev].sort((a, b) => 
                new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
              );
            } else if (eventType === "UPDATE") {
              return prev.map(s => s.phone_number === newSession.phone_number ? newSession : s)
                .sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
            } else if (eventType === "DELETE") {
              return prev.filter(s => s.phone_number !== payload.old.phone_number);
            }
            return prev;
          });
        }
      )
      .subscribe();

    const fetchConfig = async () => {
      try {
        const { data } = await supabaseClient
          .from("ai_config")
          .select("*")
          .eq("id", 1)
          .single();
        if (data) setConfig(data as AiConfig);
      } catch (err) {
        console.error("Error fetching config:", err);
      }
    };

    fetchConfig();

    // Request Notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Global listener for new messages to trigger notifications
    const globalMessagesChannel = supabaseClient
      .channel('global_messages')
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.role === 'client' && typeof window !== 'undefined') {
            // Check if permission granted
            if ('Notification' in window && Notification.permission === 'granted') {
              let body = newMsg.content;
              if (body.includes('[IMAGE:')) body = '📷 Mengirim Gambar';
              
              const notification = new Notification(`Pesan dari ${newMsg.phone_number}`, {
                body: body,
                icon: '/favicon.ico' // Default icon fallback
              });
              
              // Optional audio ping
              try {
                // If we don't have a file, Audio constructor might fail or do nothing, 
                // but the system notification sound usually plays automatically on Windows/macOS.
              } catch (e) {}
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(sessionsChannel);
      supabaseClient.removeChannel(globalMessagesChannel);
    };
  }, []);

  // 2. Fetch messages when a session is selected & Subscribe to messages
  useEffect(() => {
    if (!selectedPhone) return;

    const fetchMessages = async () => {
      setMessagesLoading(true);
      try {
        const { data, error } = await supabaseClient
          .from("messages")
          .select("*")
          .eq("phone_number", selectedPhone)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err: any) {
        console.error("Error fetching messages:", err);
        setError("Gagal memuat pesan.");
      } finally {
        setMessagesLoading(false);
        scrollToBottom();
      }
    };

    fetchMessages();

    // Realtime Subscription for Messages
    const messagesChannel = supabaseClient
      .channel(`messages_${selectedPhone}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "messages",
          filter: `phone_number=eq.${selectedPhone}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(messagesChannel);
    };
  }, [selectedPhone]);

  // 3. Auto-scroll effect when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 4. Handle sending manual reply
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !selectedImage) || !selectedPhone || isSending) return;

    setIsSending(true);
    setError(null);
    const content = inputValue;
    const currentImage = selectedImage;
    
    setInputValue(""); // Optimistic clear
    setSelectedImage(null);

    try {
      const formData = new FormData();
      formData.append("phone_number", selectedPhone);
      formData.append("content", content);
      if (currentImage) {
        formData.append("image", currentImage);
      }

      const res = await fetch("/api/manual-reply", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal mengirim pesan.");
      
      // We don't need to manually append the message here because
      // the webhook/realtime subscription will catch it and update the UI automatically.
    } catch (err: any) {
      console.error("Send message error:", err);
      setError(err.message || "Gagal mengirim pesan.");
      setInputValue(content); // Restore input on error
      setSelectedImage(currentImage);
    } finally {
      setIsSending(false);
    }
  };

  // 5. Toggle AI Auto-Reply
  const toggleBotStatus = async () => {
    if (!selectedPhone) return;
    
    const currentSession = sessions.find(s => s.phone_number === selectedPhone);
    if (!currentSession) return;

    const newStatus = !currentSession.is_bot_active;
    
    // Optimistic UI update via the realtime channel, but let's do it explicitly if needed
    try {
      const { error } = await supabaseClient
        .from("sessions")
        .update({ is_bot_active: newStatus })
        .eq("phone_number", selectedPhone);
        
      if (error) throw error;
    } catch (err: any) {
      console.error("Failed to toggle bot:", err);
      setError("Gagal merubah status AI.");
    }
  };

  // Format date helper
  const formatTime = (isoStr: string) => {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoStr));
  };

  const formatDate = (isoStr: string) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
    }).format(new Date(isoStr));
  };

  const activeSession = sessions.find(s => s.phone_number === selectedPhone);

  // Handle Quick Reply
  const handleQuickReply = (text: string) => {
    setInputValue(text);
  };

  // Update Session Status
  const updateSessionStatus = async (newBaseStatus: 'new' | 'pending' | 'done') => {
    if (!selectedPhone) return;
    const currentSession = sessions.find(s => s.phone_number === selectedPhone);
    const parsed = parseStatus(currentSession?.status);
    const updatedStatus = `${newBaseStatus}|${parsed.mood}|${parsed.lang}|${parsed.payment}`;

    try {
      const { error } = await supabaseClient
        .from("sessions")
        .update({ status: updatedStatus })
        .eq("phone_number", selectedPhone);
      if (error) throw error;
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setError("Gagal merubah status.");
    }
  };

  const handlePaymentConfirmation = async (paymentStatus: 'paid' | 'unpaid') => {
    if (!selectedPhone) return;
    setIsSending(true);
    try {
      const currentSession = sessions.find(s => s.phone_number === selectedPhone);
      const parsed = parseStatus(currentSession?.status);
      const updatedStatus = `${parsed.base}|${parsed.mood}|${parsed.lang}|${paymentStatus}`;

      // Update session status
      await supabaseClient
        .from("sessions")
        .update({ status: updatedStatus })
        .eq("phone_number", selectedPhone);

      // Send auto message
      const content = paymentStatus === 'paid' 
        ? "Terima kasih Kak, pembayaran sudah kami terima. Pesanan segera diproses! 🎉"
        : "Maaf Kak, setelah kami cek, dananya belum masuk. Boleh minta tolong kirim foto bukti transfernya? 🙏";

      const res = await fetch("/api/manual-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: selectedPhone, content }),
      });
      if (!res.ok) throw new Error("Gagal kirim pesan konfirmasi.");
    } catch (err: any) {
      console.error(err);
      setError("Gagal mengonfirmasi pembayaran.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans antialiased overflow-hidden">
      
      {/* LEFT SIDEBAR: Sessions List */}
      <aside className={`${selectedPhone ? "hidden md:flex" : "flex w-full"} ${isSidebarCollapsed ? "md:w-20" : "md:w-80"} flex-shrink-0 bg-card border-r border-border flex-col h-full z-10 transition-all duration-300 relative`}>
        
        {/* Toggle Button (Middle Right Edge) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-card hover:bg-primary text-muted-foreground hover:text-primary-foreground border-2 border-border items-center justify-center rounded-full transition-all shadow-md z-50 group cursor-pointer"
          title="Toggle Sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110">
            {isSidebarCollapsed ? (
              <polyline points="9 18 15 12 9 6"></polyline>
            ) : (
              <polyline points="15 18 9 12 15 6"></polyline>
            )}
          </svg>
        </button>

        <div className={`h-16 border-b border-border flex items-center bg-card/80 backdrop-blur-md transition-all duration-300 ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-5 justify-between'}`}>
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="bg-primary text-primary-foreground p-1.5 rounded-lg flex-shrink-0">
                  <MessageSquare size={18} />
                </div>
                <h1 className="font-semibold text-lg tracking-tight whitespace-nowrap">Inbox</h1>
              </div>
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-1 rounded-full whitespace-nowrap">
                {sessions.length} Chat
              </span>
            </>
          ) : (
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg flex-shrink-0">
              <MessageSquare size={18} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {sessionsLoading ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="animate-spin mb-2" size={24} />
              <p className="text-sm">Memuat sesi...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
              <MessageSquare size={32} className="mb-3 opacity-20" />
              <p className="text-sm">Belum ada percakapan masuk.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <AnimatePresence>
                {sessions.map((session, index) => {
                  // Stable client name based on phone string sorted alphabetically
                  const stableIndex = [...sessions].sort((a,b) => a.phone_number.localeCompare(b.phone_number)).findIndex(s => s.phone_number === session.phone_number);
                  const clientName = `Client ${stableIndex + 1}`;
                  
                  return (
                    <motion.button
                      key={session.phone_number}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setSelectedPhone(session.phone_number)}
                      className={`w-full text-left p-4 transition-all duration-200 flex flex-col gap-1.5 outline-none focus:bg-muted ${
                        selectedPhone === session.phone_number 
                          ? "bg-primary/10 relative hover:bg-primary/20" 
                          : "hover:bg-muted"
                      }`}
                    >
                    {selectedPhone === session.phone_number && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
                    )}
                    
                    {isSidebarCollapsed ? (
                      <div className="flex flex-col items-center justify-center w-full gap-2">
                         <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                            C{stableIndex + 1}
                         </div>
                         <div className={`w-2 h-2 rounded-full ${session.is_bot_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center w-full">
                          <span className="font-medium text-[15px] truncate text-foreground">
                            {clientName}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                            <Clock size={10} />
                            {formatDate(session.last_active)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${session.is_bot_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                            <span className={`text-[12px] font-medium ${session.is_bot_active ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {session.is_bot_active ? 'AI Active' : 'Manual'}
                            </span>
                          </div>
                        </div>
                        {/* Status Badge */}
                        {session.status && session.status !== 'new' && (
                          <div className={`mt-2 self-start inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            session.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {session.status}
                          </div>
                        )}
                      </>
                    )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Sidebar Bottom: Menus */}
        <div className={`p-4 border-t border-border flex flex-col gap-2 ${isSidebarCollapsed ? 'items-center' : ''}`}>
          <button
            onClick={() => setSelectedPhone("DASHBOARD")}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 py-2.5 px-4'} rounded-xl font-medium transition-all duration-200 ${
              selectedPhone === "DASHBOARD" || selectedPhone === null
                ? "bg-primary/20 text-primary shadow-sm"
                : "bg-transparent border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Dashboard Utama"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedPhone === "DASHBOARD" || selectedPhone === null ? "bg-primary/20" : "bg-muted text-muted-foreground"}`}>
              <LayoutDashboard size={16} />
            </div>
            {!isSidebarCollapsed && "Dashboard Utama"}
          </button>
          
          <button
            onClick={() => setSelectedPhone("PRODUCTS")}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 py-2.5 px-4'} rounded-xl font-medium transition-all duration-200 ${
              selectedPhone === "PRODUCTS"
                ? "bg-primary/20 text-primary shadow-sm"
                : "bg-transparent border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Katalog Produk"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedPhone === "PRODUCTS" ? "bg-primary/20" : "bg-muted text-muted-foreground"}`}>
              <Package size={16} />
            </div>
            {!isSidebarCollapsed && "Katalog Produk"}
          </button>
          
          <button
            onClick={() => setSelectedPhone("SETTINGS")}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 py-2.5 px-4'} rounded-xl font-medium transition-all duration-200 ${
              selectedPhone === "SETTINGS"
                ? "bg-primary/20 text-primary shadow-sm"
                : "bg-transparent border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Pengaturan AI"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedPhone === "SETTINGS" ? "bg-primary/20" : "bg-muted text-muted-foreground"}`}>
              <Settings size={16} />
            </div>
            {!isSidebarCollapsed && "Pengaturan AI"}
          </button>
          
          <div className={`mt-2 flex ${isSidebarCollapsed ? 'justify-center' : 'px-2'}`}>
            <ThemeToggle isCollapsed={isSidebarCollapsed} />
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN AREA: Chat View */}
      <main className={`${!selectedPhone ? "hidden md:flex" : "flex w-full"} flex-1 flex-col h-full bg-background relative overflow-hidden`}>
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg border border-red-100 dark:border-red-800/50 shadow-sm flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">&times;</button>
          </div>
        )}

        {selectedPhone === "SETTINGS" || selectedPhone === "PRODUCTS" || selectedPhone === "DASHBOARD" ? (
          <>
            <header className="md:hidden h-14 px-4 bg-card/80 backdrop-blur-md border-b border-border flex flex-shrink-0 items-center gap-3 sticky top-0 z-50">
              <button onClick={() => setSelectedPhone(null)} className="p-1.5 -ml-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                <ArrowLeft size={20} />
              </button>
              <h2 className="font-semibold text-foreground text-sm">
                {selectedPhone === "SETTINGS" ? "Pengaturan AI" : selectedPhone === "PRODUCTS" ? "Katalog Produk" : "Dashboard Utama"}
              </h2>
            </header>
            <div className="flex-1 overflow-y-auto">
              {selectedPhone === "SETTINGS" ? <SettingsView /> : selectedPhone === "PRODUCTS" ? <ProductsView /> : <DashboardOverview />}
            </div>
          </>
        ) : !selectedPhone ? (
          <div className="flex-1 hidden md:flex flex-col overflow-hidden">
            <DashboardOverview />
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full bg-background/50 relative">
            {/* Chat Header */}
            <header className="h-16 px-4 md:px-6 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setSelectedPhone(null)} className="md:hidden mr-1 p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold border border-primary/30 shadow-sm flex-shrink-0 overflow-hidden">
                  {selectedPhone === "SETTINGS" ? "⚙️" : selectedPhone === "PRODUCTS" ? <Package size={20} /> : (config?.profile_url ? <img src={config.profile_url} alt="Profile" className="w-full h-full object-cover" /> : selectedPhone.substring(0, 2))}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground truncate max-w-[150px] md:max-w-none">
                    {selectedPhone === "SETTINGS" ? "Pengaturan AI" : selectedPhone === "PRODUCTS" ? "Katalog Produk" : (
                      <span className="flex items-center gap-1.5">
                        {getLangFlag(parseStatus(activeSession?.status).lang)} {config?.business_name || `+${selectedPhone}`} {getMoodEmoji(parseStatus(activeSession?.status).mood)}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    {(selectedPhone === "SETTINGS" || selectedPhone === "PRODUCTS") ? "Sistem" : "Terhubung"}
                  </p>
                </div>
              </div>

              {/* Actions Right */}
              {(selectedPhone !== "SETTINGS" && selectedPhone !== "PRODUCTS") && (
                <div className="flex items-center gap-3">
                  {/* Status Dropdown */}
                  <div className="relative group">
                    <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                      parseStatus(activeSession?.status).base === 'pending' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                      parseStatus(activeSession?.status).base === 'done' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                      'bg-card border-border text-foreground hover:bg-muted'
                    }`}>
                      <Tag size={12} />
                      {parseStatus(activeSession?.status).base === 'pending' ? 'Pending' : parseStatus(activeSession?.status).base === 'done' ? 'Selesai' : 'Baru'}
                    </button>
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                      <button onClick={() => updateSessionStatus('new')} className="w-full text-left px-4 py-2 text-xs font-medium text-foreground hover:bg-muted">Label: Baru</button>
                      <button onClick={() => updateSessionStatus('pending')} className="w-full text-left px-4 py-2 text-xs font-medium text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 border-t border-border">Label: Pending</button>
                      <button onClick={() => updateSessionStatus('done')} className="w-full text-left px-4 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-t border-border">Label: Selesai</button>
                    </div>
                  </div>

                  {/* AI Toggle Switch */}
                  <div className="flex items-center gap-3 bg-muted px-3 py-1.5 rounded-full border border-border shadow-inner">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      {activeSession?.is_bot_active ? <Bot size={14} className="text-primary"/> : <BotOff size={14} className="text-muted-foreground"/>}
                      {activeSession?.is_bot_active ? "AI Aktif" : "Manual"}
                    </span>
                    <button 
                      onClick={toggleBotStatus}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:focus:ring-offset-background ${
                        activeSession?.is_bot_active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-300 shadow-sm ${
                          activeSession?.is_bot_active ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </header>

            {/* Payment Banner */}
            {activeSession && parseStatus(activeSession.status).payment === 'claimed' && (
              <div className="mx-4 md:mx-6 mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                    💰
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary text-sm">Pelanggan Mengklaim Sudah Membayar</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Mohon cek mutasi rekening Anda sekarang. Apakah dananya sudah masuk?</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => handlePaymentConfirmation('unpaid')}
                    disabled={isSending}
                    className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    ❌ Belum Lunas
                  </button>
                  <button 
                    onClick={() => handlePaymentConfirmation('paid')}
                    disabled={isSending}
                    className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    ✅ Konfirmasi Lunas
                  </button>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-5 scrollbar-thin">
              {messagesLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-muted-foreground" size={32} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="text-sm bg-card px-5 py-2.5 rounded-full shadow-sm border border-border">Belum ada pesan.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => {
                    const isClient = msg.role === "client";
                    const isAi = msg.role === "ai";
                    const isAdmin = msg.role === "admin";
                    
                    // Add date separators if day changes
                    const showDate = idx === 0 || 
                      new Date(messages[idx-1].created_at).toDateString() !== new Date(msg.created_at).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="text-[11px] font-medium text-muted-foreground bg-card border border-border shadow-sm px-4 py-1.5 rounded-full">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}
                        
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className={`flex w-full ${isClient ? "justify-start" : "justify-end"}`}
                        >
                          <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isClient ? "items-start" : "items-end"}`}>
                            
                            {/* Chat Bubble */}
                            <div
                              className={`px-5 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed relative group ${
                                isClient
                                  ? "bg-card text-card-foreground border border-border rounded-bl-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                                  : isAi
                                  ? "bg-primary text-primary-foreground rounded-br-sm shadow-[0_4px_14px_-6px_rgba(var(--primary),0.4)]"
                                  : "bg-foreground text-background rounded-br-sm shadow-[0_4px_14px_-6px_rgba(0,0,0,0.4)]"
                              }`}
                            >
                              {!isClient && (
                                <div className="text-[11px] font-bold tracking-wide mb-1 opacity-80 flex items-center gap-1.5 justify-end">
                                  {isAi ? (
                                    <><Bot size={12} /> Dibalas oleh AI</>
                                  ) : (
                                    <><User size={12} /> Dibalas oleh Admin</>
                                  )}
                                </div>
                              )}
                              {/* Render Content */}
                              {msg.content.match(/\[IMAGE:(.*?)\]/) ? (
                                <>
                                  {msg.content.replace(/\[IMAGE:.*?\]/g, "").trim() && (
                                    <p className="whitespace-pre-wrap break-words mb-2">
                                      {msg.content.replace(/\[IMAGE:.*?\]/g, "").trim()}
                                    </p>
                                  )}
                                  <div className="rounded-lg overflow-hidden border border-border/20 max-w-[240px] mt-2 relative bg-black/5">
                                    <img 
                                      src={`/api/media/${msg.content.match(/\[IMAGE:(.*?)\]/)?.[1]}`} 
                                      alt="Bukti Transfer" 
                                      className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300"
                                      loading="lazy"
                                    />
                                  </div>
                                </>
                              ) : (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              )}
                              
                              {/* Timestamp */}
                              <div className={`text-[10px] mt-2 flex items-center ${isClient ? "justify-start text-muted-foreground" : "justify-end text-primary-foreground/70"}`}>
                                {formatTime(msg.created_at)}
                                {(!isClient) && <CheckCircle2 size={10} className="ml-1 opacity-80" />}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-card/80 backdrop-blur-md border-t border-border/60 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10 relative">
              {/* Quick Replies */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                <button onClick={() => handleQuickReply("Terima kasih sudah berbelanja 🙏")} className="whitespace-nowrap px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[13px] font-medium rounded-full transition-colors border border-border">
                  Terima kasih 🙏
                </button>
                <button onClick={() => handleQuickReply("Pesanan Kakak sedang kami proses 📦")} className="whitespace-nowrap px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[13px] font-medium rounded-full transition-colors border border-border">
                  Pesanan diproses 📦
                </button>
                <button onClick={() => handleQuickReply("Mohon ditunggu sebentar ya kak 😊")} className="whitespace-nowrap px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[13px] font-medium rounded-full transition-colors border border-border">
                  Mohon tunggu 😊
                </button>
                <button onClick={() => handleQuickReply("Ada yang bisa kami bantu kak?")} className="whitespace-nowrap px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[13px] font-medium rounded-full transition-colors border border-border">
                  Ada yang bisa dibantu?
                </button>
              </div>

              <form 
                onSubmit={handleSendMessage}
                className="flex items-end gap-2 md:gap-3 max-w-4xl mx-auto flex-col"
              >
                {selectedImage && (
                  <div className="w-full flex justify-start">
                    <div className="relative group rounded-xl overflow-hidden border border-border/50 max-w-[200px] shadow-sm">
                      <img 
                        src={URL.createObjectURL(selectedImage)} 
                        alt="Preview" 
                        className="w-full h-auto object-cover max-h-[150px]"
                      />
                      <button 
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-end gap-2 md:gap-3 w-full">
                  <div className="flex-1 bg-muted rounded-2xl border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200 overflow-hidden shadow-inner flex items-center px-3 md:px-4 py-2 min-h-[52px]">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-muted-foreground hover:text-primary transition-colors mr-2"
                      title="Lampirkan Gambar"
                    >
                      <Paperclip size={20} />
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedImage(file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={activeSession?.is_bot_active ? "Ketik pesan (Auto-reply AI masih aktif)..." : "Ketik balasan Anda..."}
                      className="w-full bg-transparent border-none focus:ring-0 resize-none outline-none text-foreground placeholder-muted-foreground py-2 max-h-32 text-[14px] md:text-[15px]"
                      rows={1}
                      style={{ height: 'auto', minHeight: '1.5rem' }}
                      disabled={isSending}
                    />
                  </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={!inputValue.trim() || isSending}
                  className="h-[52px] w-[52px] rounded-2xl bg-primary hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground text-primary-foreground flex items-center justify-center transition-colors shadow-md shadow-primary/30 disabled:shadow-none flex-shrink-0"
                >
                  {isSending ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send size={18} className="ml-0.5" />
                  )}
                </motion.button>
                </div>
              </form>
              <div className="text-center mt-3 text-[11px] text-muted-foreground font-medium tracking-wide">
                Tekan <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-sans">Enter</kbd> untuk mengirim, <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-sans">Shift+Enter</kbd> baris baru.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
