'use client';

import type { ReactNode } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function TerceiroLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="border-b bg-white/70 backdrop-blur dark:bg-[#0b1220]/70">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/terceiro" className="font-semibold tracking-tight">Portal <span className="text-primary">Terceiro</span></Link>
          <nav className="flex items-center gap-2">
            <Link className="btn btn-secondary" href="/terceiro">Início</Link>
            <form action="/api/token-session" method="POST" onSubmit={async (e) => { e.preventDefault(); await fetch("/api/token-session", { method: "DELETE" }); location.href = "/acesso"; }}>
              <button type="submit" className="btn btn-outline">Sair</button>
            </form>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <div className="container mx-auto px-4 pb-6">
        <main className="w-full max-w-[1200px] mx-auto">{children}</main>
      </div>
    </div>
  );
}