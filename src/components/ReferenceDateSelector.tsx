"use client";

import { type ChangeEvent, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DEFAULT_TIME_ZONE } from "@/lib/referenceDate";

type Props = { value: string; label?: string; showTimeZoneNote?: boolean };

export default function ReferenceDateSelector({ value, label = "Data de referência", showTimeZoneNote = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    startTransition(() => {
      if (newValue) {
        currentParams.set("refDate", newValue);
      } else {
        currentParams.delete("refDate");
      }
      const query = currentParams.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(target, { scroll: false });
      router.refresh();
    });
  };

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}{showTimeZoneNote ? <span className="ml-2 font-normal text-[11px] text-muted-foreground/80">{DEFAULT_TIME_ZONE}</span> : null}</span>
      <input
        type="date"
        name="refDate"
        value={value}
        onChange={handleChange}
        className="w-full rounded-lg border px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/60"
        aria-label="Selecionar data de referência"
        disabled={isPending}
      />
    </label>
  );
}
