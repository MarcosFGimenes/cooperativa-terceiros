"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Mode = "light" | "dark";

function readThemeFromDom(): Mode {
  if (typeof document === "undefined") {
    return "light";
  }
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

function hasThemeCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return /(?:^|; )theme=/.test(document.cookie);
}

function persistTheme(theme: Mode) {
  if (typeof document === "undefined") {
    return;
  }
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `theme=${theme}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Mode>(() => readThemeFromDom());
  const [hasCookie, setHasCookie] = useState<boolean>(() => hasThemeCookie());

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    persistTheme(theme);
    setHasCookie(true);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (hasCookie) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const updateFromSystemPreference = () => {
      setTheme(media.matches ? "dark" : "light");
    };

    updateFromSystemPreference();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", updateFromSystemPreference);
      return () => media.removeEventListener("change", updateFromSystemPreference);
    }

    media.addListener(updateFromSystemPreference);
    return () => media.removeListener(updateFromSystemPreference);
  }, [hasCookie]);

  const icon = useMemo(() => (theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />), [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <button
      type="button"
      aria-label="Alternar tema"
      className="btn btn-ghost h-11 w-11 rounded-full"
      data-theme={theme}
      onClick={toggleTheme}
    >
      {icon}
    </button>
  );
}
