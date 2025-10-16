import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import SkipToContent from "@/components/SkipToContent";
import Footer from "@/components/Footer";
import ThemeScript from "@/components/ThemeScript";

export const metadata = {
  title: "PCM • Terceiros",
  description: "Acompanhamento de serviços de terceiros (PCM)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <SkipToContent />
        <header className="border-b bg-background/70 backdrop-blur dark:bg-[#0b1220]/70">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <Link href="/" className="font-semibold tracking-tight">
              PCM <span className="text-primary">Terceiros</span>
            </Link>
            <nav className="flex items-center gap-3 sm:gap-4 text-sm">
              <Link className="link" href="/login">Login</Link>
              <Link className="link" href="/acesso">Acesso por token</Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main id="conteudo" className="min-h-[calc(100dvh-56px-48px)]">{children}</main>
        <Footer />
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
