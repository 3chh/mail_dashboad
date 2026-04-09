"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark";

function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem("theme-preference");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const hydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );
  const [theme, setTheme] = useState<ThemeMode>(resolveInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("theme-preference", theme);
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="control-surface inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-foreground transition"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={hydrated ? (isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối") : "Chuyển giao diện"}
      title={hydrated ? (isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối") : "Chuyển giao diện"}
    >
      {hydrated ? (
        isDark ? <Sun className="mr-2 h-4 w-4 text-primary" /> : <Moon className="mr-2 h-4 w-4 text-primary" />
      ) : (
        <Moon className="mr-2 h-4 w-4 text-primary" />
      )}
      {hydrated ? (isDark ? "Sáng" : "Tối") : "Giao diện"}
    </button>
  );
}
