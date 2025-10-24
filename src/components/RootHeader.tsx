"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import HeaderClientBoundary from "@/components/HeaderClientBoundary";

const HIDDEN_PREFIXES = ["/terceiro"];

function shouldHideHeader(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function RootHeader() {
  const pathname = usePathname();

  if (shouldHideHeader(pathname)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/80 shadow-sm backdrop-blur-md dark:border-slate-800/70 dark:bg-[#0b1220]/80">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          PCM <span className="text-primary">Terceiros</span>
        </Link>
        <HeaderClientBoundary />
      </div>
    </header>
  );
}
