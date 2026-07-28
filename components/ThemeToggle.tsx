"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@/components/Icons";

export function ThemeToggle({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10" />; // Placeholder to avoid layout shift
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`w-full flex items-center ${
        isCollapsed ? 'justify-center p-2' : 'gap-3 py-2.5 px-4'
      } rounded-xl font-medium transition-all duration-200 bg-transparent border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground`}
      title={theme === "dark" ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground`}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </div>
      {!isCollapsed && (theme === "dark" ? "Mode Terang" : "Mode Gelap")}
    </button>
  );
}
