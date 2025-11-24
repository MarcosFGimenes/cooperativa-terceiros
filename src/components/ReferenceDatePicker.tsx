"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  DEFAULT_REFERENCE_DATE_PARAM,
  DEFAULT_REFERENCE_TIME_ZONE,
  getTodayReferenceInput,
} from "@/lib/referenceDate";
import { cn } from "@/lib/utils";

type ReferenceDatePickerProps = {
  label?: string;
  helperText?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  timeZone?: string;
  queryParam?: string;
  persistQuery?: boolean;
  className?: string;
  id?: string;
  align?: "left" | "right";
};

export default function ReferenceDatePicker({
  label = "Data de referência",
  helperText,
  value,
  onChange,
  timeZone = DEFAULT_REFERENCE_TIME_ZONE,
  queryParam = DEFAULT_REFERENCE_DATE_PARAM,
  persistQuery = false,
  className,
  id,
  align = "right",
}: ReferenceDatePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const todayValue = useMemo(() => getTodayReferenceInput(timeZone), [timeZone]);

  const [internalValue, setInternalValue] = useState(() => value ?? todayValue);

  useEffect(() => {
    if (value && value !== internalValue) {
      setInternalValue(value);
      return;
    }
    if (!value && internalValue !== todayValue) {
      setInternalValue(todayValue);
    }
  }, [value, internalValue, todayValue]);

  const updateQueryString = useCallback(
    (nextValue: string) => {
      if (!persistQuery) return;
      const params = new URLSearchParams(searchParams?.toString());
      if (nextValue) {
        params.set(queryParam, nextValue);
      } else {
        params.delete(queryParam);
      }
      const nextSearch = params.toString();
      router.replace(`${pathname}${nextSearch ? `?${nextSearch}` : ""}`, { scroll: false });
    },
    [persistQuery, searchParams, queryParam, router, pathname],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setInternalValue(nextValue);
      onChange?.(nextValue);
      updateQueryString(nextValue);
    },
    [onChange, updateQueryString],
  );

  const handleReset = useCallback(() => {
    setInternalValue(todayValue);
    onChange?.(todayValue);
    updateQueryString(todayValue);
  }, [onChange, todayValue, updateQueryString]);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-dashed border-border/60 bg-card/60 p-3 text-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-1 sm:flex-row sm:items-center",
          align === "right" ? "sm:justify-between" : "sm:justify-start sm:gap-3",
        )}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </label>
          {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id={id}
            type="date"
            value={internalValue}
            className="min-w-[160px] rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onChange={handleChange}
          />
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary"
            onClick={handleReset}
          >
            Hoje
          </button>
        </div>
      </div>
    </div>
  );
}
