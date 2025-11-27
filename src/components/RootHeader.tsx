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
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 font-semibold tracking-tight text-slate-800"
        >
          <span className="flex items-center gap-3 font-sans leading-none">
            <span aria-hidden className="text-[22px] text-[#ff4b5c] sm:text-[23px]">♥</span>
            <span className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-[23px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-50 sm:text-[25px]">
                Lar
              </span>
              <span className="text-sm font-medium leading-tight text-slate-600 dark:text-slate-400 sm:text-[15px]">
                - Acompanhamento de Terceiros
              </span>
            </span>
          </span>
        </Link>
        <HeaderClientBoundary />
      </div>
    </header>
  );
}
