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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/85 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/70 dark:bg-[#0b1220]/85">
      <div className="mx-auto flex h-14 w-full max-w-screen-xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="flex items-center gap-3 font-sans leading-tight text-slate-800">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-xl text-[#ff4b5c] shadow-sm"
            >
              ♥
            </span>
            <span className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-[22px] font-semibold text-[#2d2d2d]">Lar</span>
              <span className="text-[15px] font-medium text-slate-500">- Acompanhamento de Terceiros</span>
            </span>
          </span>
        </Link>
        <HeaderClientBoundary />
      </div>
    </header>
  );
}
