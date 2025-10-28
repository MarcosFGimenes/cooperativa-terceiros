import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import RootHeader from "@/components/RootHeader";
import SkipToContent from "@/components/SkipToContent";
import Footer from "@/components/Footer";
import PreloadAsFix from "@/components/PreloadAsFix";
import FirebaseConfigScript from "@/components/FirebaseConfigScript";

type ThemeMode = "light" | "dark";

async function resolveInitialTheme(): Promise<ThemeMode> {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  if (themeCookie === "light" || themeCookie === "dark") {
    return themeCookie;
  }
  return "light";
}

export const metadata = {
  title: "PCM • Terceiros",
  description: "Acompanhamento de serviços de terceiros (PCM)",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await resolveInitialTheme();

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-theme={theme}
      className={theme === "dark" ? "dark" : undefined}
    >
      <head>
        <PreloadAsFix />
        <FirebaseConfigScript />
      </head>
      <body className="relative bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute left-[-15%] top-[-20%] h-64 w-64 rounded-full bg-primary/20 blur-[120px] dark:bg-primary/25" />
          <div className="absolute right-[-18%] top-[-10%] h-72 w-72 rounded-full bg-emerald-200/35 blur-[140px] dark:bg-slate-900/60" />
          <div className="absolute inset-x-0 bottom-[-35%] h-[320px] bg-gradient-to-t from-primary/15 via-transparent to-transparent dark:from-primary/25" />
        </div>
        <SkipToContent />
        <RootHeader />
        <main id="conteudo" className="relative min-h-[calc(100dvh-56px-48px)] py-6 sm:py-10">
          <div className="relative z-10">{children}</div>
        </main>
        <Footer />
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
