"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

type ThemeMode = "light" | "dark";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );

  const theme = (resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : "dark") as ThemeMode;
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="control-surface inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-foreground transition"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? (isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối") : "Chuyển giao diện"}
      title={mounted ? (isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối") : "Chuyển giao diện"}
    >
      {mounted ? (
        isDark ? <Sun className="mr-2 h-4 w-4 text-primary" /> : <Moon className="mr-2 h-4 w-4 text-primary" />
      ) : (
        <Moon className="mr-2 h-4 w-4 text-primary" />
      )}
      {mounted ? (isDark ? "Sáng" : "Tối") : "Giao diện"}
    </button>
  );
}
