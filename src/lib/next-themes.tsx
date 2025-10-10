"use client";

import * as React from "react";

type ThemeMode = "light" | "dark" | "system" | string;

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeProviderProps {
  attribute?: string;
  defaultTheme?: ThemeMode;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  children: React.ReactNode;
}

export function ThemeProvider({
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  children,
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<ThemeMode>(defaultTheme);
  const [resolved, setResolved] = React.useState<"light" | "dark">(
    defaultTheme === "system" ? getSystemTheme() : (defaultTheme as "light" | "dark")
  );

  React.useEffect(() => {
    if (!enableSystem) {
      setResolved((theme as "light" | "dark") ?? "light");
      return;
    }

    const update = () => {
      const system = getSystemTheme();
      setResolved(theme === "system" ? system : (theme as "light" | "dark"));
    };

    update();
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
  }, [theme, enableSystem]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const applied = theme === "system" ? (enableSystem ? getSystemTheme() : "light") : theme;
    const applyTheme = () => {
      if (disableTransitionOnChange) {
        const css = document.createElement("style");
        css.appendChild(document.createTextNode("*{transition:none !important}"));
        document.head.appendChild(css);
        requestAnimationFrame(() => {
          css.parentNode?.removeChild(css);
        });
      }
      root.setAttribute(attribute, applied as string);
      root.classList.remove("light", "dark");
      if (applied === "dark" || applied === "light") {
        root.classList.add(applied);
      }
    };
    applyTheme();
  }, [attribute, disableTransitionOnChange, enableSystem, theme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme: resolved, setTheme }),
    [theme, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  }
  return context;
}
