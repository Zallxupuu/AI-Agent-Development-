"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseClient } from "@/lib/supabase-client";
import SettingsView from "@/components/SettingsView";
import ProductsView from "@/components/ProductsView";
import DashboardOverview from "@/components/DashboardOverview";
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
  Tag
} from "@/components/Icons";

export default function Dashboard() {
  // State for Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [config, setConfig] = useState<AiConfig | null>(null);

  // State for Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // State for Input & Sending
  const [inputValue, setInputValue] = useState("");
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

    return () => {
      supabaseClient.removeChannel(sessionsChannel);
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
    if (!inputValue.trim() || !selectedPhone || isSending) return;

    setIsSending(true);
    setError(null);
    const content = inputValue;
    setInputValue(""); // Optimistic clear

    try {
      const res = await fetch("/api/manual-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: selectedPhone, content }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal mengirim pesan.");
      
      // We don't need to manually append the message here because
      // the webhook/realtime subscription will catch it and update the UI automatically.
    } catch (err: any) {
      console.error("Send message error:", err);
      setError(err.message || "Gagal mengirim pesan.");
      setInputValue(content); // Restore input on error
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

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans antialiased overflow-hidden">
      
      {/* LEFT SIDEBAR: Sessions List */}
      <aside className={`${selectedPhone ? "hidden md:flex" : "flex w-full"} md:w-80 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-full z-10`}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="bg-black text-white p-1.5 rounded-lg">
              <MessageSquare size={18} />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Inbox</h1>
          </div>
          <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
            {sessions.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {sessionsLoading ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Loader2 className="animate-spin mb-2" size={24} />
              <p className="text-sm">Memuat sesi...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <MessageSquare size={32} className="mb-3 opacity-20" />
              <p className="text-sm">Belum ada percakapan masuk.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <AnimatePresence initial={false}>
                {sessions.map((session) => (
                  <motion.button
                    key={session.phone_number}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setSelectedPhone(session.phone_number)}
                    className={`w-full text-left p-4 transition-all duration-200 flex flex-col gap-1.5 outline-none focus:bg-gray-50 ${
                      selectedPhone === session.phone_number 
                        ? "bg-blue-50/50 relative hover:bg-blue-50/80" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                  {selectedPhone === session.phone_number && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-600" />
                  )}
                  <div className="flex justify-between items-center w-full">
                    <span className="font-medium text-[15px] truncate text-gray-800">
                      +{session.phone_number}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1 font-medium">
                      <Clock size={10} />
                      {formatDate(session.last_active)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${session.is_bot_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-300'}`} />
                      <span className={`text-[12px] font-medium ${session.is_bot_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {session.is_bot_active ? 'AI Active' : 'Manual'}
                      </span>
                    </div>
                  </div>
                  {/* Status Badge */}
                  {session.status && session.status !== 'new' && (
                    <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      session.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {session.status}
                    </div>
                  )}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Sidebar Bottom: Menus */}
        <div className="p-4 border-t border-gray-200 flex flex-col gap-2">
          <button
            onClick={() => setSelectedPhone("PRODUCTS")}
            className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
              selectedPhone === "PRODUCTS"
                ? "bg-blue-100 text-blue-700 shadow-sm"
                : "bg-white border border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-200"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedPhone === "PRODUCTS" ? "bg-blue-200/50" : "bg-gray-100"}`}>
              <Package size={16} />
            </div>
            Katalog Produk
          </button>
          
          <button
            onClick={() => setSelectedPhone("SETTINGS")}
            className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
              selectedPhone === "SETTINGS"
                ? "bg-purple-100 text-purple-700 shadow-sm"
                : "bg-white border border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-200"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedPhone === "SETTINGS" ? "bg-purple-200/50" : "bg-gray-100"}`}>
              <Settings size={16} />
            </div>
            Pengaturan AI
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN AREA: Chat View */}
      <main className={`${!selectedPhone ? "hidden md:flex" : "flex w-full"} flex-1 flex-col h-full bg-gray-50/50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative`}>
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 px-4 py-2 rounded-lg border border-red-100 shadow-sm flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">&times;</button>
          </div>
        )}

        {selectedPhone === "SETTINGS" ? (
          <SettingsView />
        ) : selectedPhone === "PRODUCTS" ? (
          <ProductsView />
        ) : !selectedPhone ? (
          <DashboardOverview />
        ) : (
          <div className="flex-1 flex flex-col h-full bg-gray-50/30 relative">
            {/* Chat Header */}
            <header className="h-16 px-4 md:px-6 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setSelectedPhone(null)} className="md:hidden mr-1 p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-50 flex items-center justify-center text-blue-600 font-semibold border border-blue-200/50 shadow-sm flex-shrink-0 overflow-hidden">
                  {selectedPhone === "SETTINGS" ? "⚙️" : selectedPhone === "PRODUCTS" ? <Package size={20} /> : (config?.profile_url ? <img src={config.profile_url} alt="Profile" className="w-full h-full object-cover" /> : selectedPhone.substring(0, 2))}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800 truncate max-w-[150px] md:max-w-none">
                    {selectedPhone === "SETTINGS" ? "Pengaturan AI" : selectedPhone === "PRODUCTS" ? "Katalog Produk" : (config?.business_name || `+${selectedPhone}`)}
                  </h2>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
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
                      activeSession?.status === 'pending' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                      activeSession?.status === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      'bg-white border-gray-200 text-gray-600'
                    }`}>
                      <Tag size={12} />
                      {activeSession?.status === 'pending' ? 'Pending' : activeSession?.status === 'done' ? 'Selesai' : 'Baru'}
                    </button>
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-100 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                      <button onClick={() => updateSessionStatus('new')} className="w-full text-left px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">Label: Baru</button>
                      <button onClick={() => updateSessionStatus('pending')} className="w-full text-left px-4 py-2 text-xs font-medium text-yellow-700 hover:bg-yellow-50 border-t border-gray-50">Label: Pending</button>
                      <button onClick={() => updateSessionStatus('done')} className="w-full text-left px-4 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 border-t border-gray-50">Label: Selesai</button>
                    </div>
                  </div>

                  {/* AI Toggle Switch */}
                  <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 shadow-inner">
                    <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                      {activeSession?.is_bot_active ? <Bot size={14} className="text-blue-500"/> : <BotOff size={14} className="text-gray-400"/>}
                      {activeSession?.is_bot_active ? "AI Aktif" : "Manual"}
                    </span>
                    <button 
                      onClick={toggleBotStatus}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        activeSession?.is_bot_active ? 'bg-blue-600' : 'bg-gray-300'
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

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-5 scrollbar-thin">
              {messagesLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-gray-300" size={32} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <p className="text-sm bg-white px-5 py-2.5 rounded-full shadow-sm border border-gray-100">Belum ada pesan.</p>
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
                            <span className="text-[11px] font-medium text-gray-400 bg-white border border-gray-100 shadow-sm px-4 py-1.5 rounded-full">
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
                                  ? "bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                                  : isAi
                                  ? "bg-indigo-600 text-white rounded-br-sm shadow-[0_4px_14px_-6px_rgba(79,70,229,0.4)]"
                                  : "bg-gray-900 text-white rounded-br-sm shadow-[0_4px_14px_-6px_rgba(0,0,0,0.4)]"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              
                              {/* Timestamp */}
                              <div className={`text-[10px] mt-2 flex items-center ${isClient ? "justify-start text-gray-400" : "justify-end text-indigo-200"}`}>
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
            <div className="p-3 md:p-4 bg-white/80 backdrop-blur-md border-t border-gray-200/60 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10 relative">
              {/* Quick Replies */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                <button onClick={() => handleQuickReply("Terima kasih sudah berbelanja 🙏")} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-medium rounded-full transition-colors border border-gray-200">
                  Terima kasih 🙏
                </button>
                <button onClick={() => handleQuickReply("Pesanan Kakak sedang kami proses 📦")} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-medium rounded-full transition-colors border border-gray-200">
                  Pesanan diproses 📦
                </button>
                <button onClick={() => handleQuickReply("Mohon ditunggu sebentar ya kak 😊")} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-medium rounded-full transition-colors border border-gray-200">
                  Mohon tunggu 😊
                </button>
                <button onClick={() => handleQuickReply("Ada yang bisa kami bantu kak?")} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-medium rounded-full transition-colors border border-gray-200">
                  Ada yang bisa dibantu?
                </button>
              </div>

              <form 
                onSubmit={handleSendMessage}
                className="flex items-end gap-2 md:gap-3 max-w-4xl mx-auto"
              >
                <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-200 overflow-hidden shadow-inner flex items-center px-3 md:px-4 py-2 min-h-[52px]">
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
                    className="w-full bg-transparent border-none focus:ring-0 resize-none outline-none text-gray-700 placeholder-gray-400 py-2 max-h-32 text-[14px] md:text-[15px]"
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
                  className="h-[52px] w-[52px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white flex items-center justify-center transition-colors shadow-md shadow-indigo-200 disabled:shadow-none flex-shrink-0"
                >
                  {isSending ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send size={18} className="ml-0.5" />
                  )}
                </motion.button>
              </form>
              <div className="text-center mt-3 text-[11px] text-gray-400/80 font-medium tracking-wide">
                Tekan <kbd className="px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100 font-sans">Enter</kbd> untuk mengirim, <kbd className="px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100 font-sans">Shift+Enter</kbd> baris baru.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
