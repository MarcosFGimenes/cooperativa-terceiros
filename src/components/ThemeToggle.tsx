"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Mode = "light" | "dark";

export default function ThemeToggle() {
  const getPreferredTheme = useMemo(() => {
    return (): Mode => {
      if (typeof window === "undefined") return "light";
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") return stored;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    };
  }, []);

  const [theme, setTheme] = useState<Mode>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTheme(getPreferredTheme());
    setHydrated(true);
  }, [getPreferredTheme]);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [hydrated, theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = (event: StorageEvent) => {
      if (event.key === "theme" && (event.newValue === "light" || event.newValue === "dark")) {
        setTheme(event.newValue);
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const stored = localStorage.getItem("theme");
      if (stored !== "light" && stored !== "dark") {
        setTheme(event.matches ? "dark" : "light");
      }
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <button
      type="button"
      aria-label="Alternar tema"
      className="btn-ghost h-11 w-11 rounded-full"
      data-theme={theme}
      onClick={toggleTheme}
      >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
