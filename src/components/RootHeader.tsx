"use client";

import Image from "next/image";
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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/85 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-[rgba(0,99,76,0.55)] dark:bg-[rgba(0,99,76,0.9)]">
      <div className="mx-auto flex h-14 w-full max-w-screen-xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Image
            alt="Cooperativa Lar"
            src="/lar-logo.svg"
            width={96}
            height={32}
            priority
            className="h-8 w-auto"
          />
          <span>
            PCM <span className="text-primary">Terceiros</span>
          </span>
        </Link>
        <HeaderClientBoundary />
      </div>
    </header>
  );
}
