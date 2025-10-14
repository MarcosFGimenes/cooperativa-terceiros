import "./globals.css";
import Link from "next/link";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

export const metadata = {
  title: "PCM • Terceiros",
  description: "Acompanhamento de serviços de terceiros (PCM)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b bg-white/70 backdrop-blur">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <Link href="/" className="font-semibold tracking-tight">
              PCM <span className="text-primary">Terceiros</span>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link className="link" href="/login">Login</Link>
              <Link className="link" href="/acesso">Acesso por token</Link>
            </nav>
          </div>
        </header>
        <main className="min-h-[calc(100dvh-56px)]">{children}</main>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
