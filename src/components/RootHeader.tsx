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
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="inline-flex items-center gap-2">
                <svg
                  aria-hidden
                  viewBox="0 0 64 64"
                  className="h-8 w-8 text-[#e3223b] sm:h-9 sm:w-9"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3.6"
                >
                  <path d="M32 12.5c2.6-5.4 9.2-7.3 13.7-3 3.8 3.6 4 9.9.1 13.7L32 37 18.2 23.2c-3.9-3.8-3.7-10.1.1-13.7 4.5-4.3 11.1-2.4 13.7 3Z" />
                </svg>
                <span className="text-[23px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-50 sm:text-[25px]">
                  Lar
                </span>
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
