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
      className={`flex items-center justify-center rounded-xl bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-all shadow-sm ${
        isCollapsed ? 'p-2 w-10 h-10' : 'p-2.5 w-11 h-11'
      }`}
      title={theme === "dark" ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
