import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import SkipToContent from "@/components/SkipToContent";
import Footer from "@/components/Footer";
import PreloadAsFix from "@/components/PreloadAsFix";
import ThemeScript from "@/components/ThemeScript";
import FirebaseConfigScript from "@/components/FirebaseConfigScript";

export const metadata = {
  title: "PCM • Terceiros",
  description: "Acompanhamento de serviços de terceiros (PCM)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ThemeScript />
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
        <header className="sticky top-0 z-40 border-b border-border/70 bg-white/80 shadow-sm backdrop-blur-md dark:border-slate-800/70 dark:bg-[#0b1220]/80">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <Link href="/" className="font-semibold tracking-tight">
              PCM <span className="text-primary">Terceiros</span>
            </Link>
            <nav className="flex items-center gap-3 text-sm text-muted-foreground">
              <Link className="link" href="/login">Login</Link>
              <Link className="link" href="/acesso">Acesso por token</Link>
              <Link className="link" href="/dashboard">Dashboard</Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main id="conteudo" className="relative min-h-[calc(100dvh-56px-48px)] py-6 sm:py-10">
          <div className="relative z-10">{children}</div>
        </main>
        <Footer />
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
