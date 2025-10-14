"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

type ToasterProps = {
  richColors?: boolean;
  closeButton?: boolean;
};

const listeners = new Set<(toast: ToastMessage) => void>();

function emit(toast: ToastMessage) {
  listeners.forEach((listener) => listener(toast));
}

function createToast(type: ToastType) {
  return (message: string) => {
    emit({ id: Date.now() + Math.random(), type, message });
  };
}

export const toast = {
  success: createToast("success"),
  error: createToast("error"),
  info: createToast("info"),
};

export function Toaster({ closeButton }: ToasterProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts((current) => [...current, toast]);
      setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-soft ${
            toast.type === "success"
              ? "border-brand-200 bg-brand-50 text-brand-800"
              : toast.type === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-muted-foreground/20 bg-muted text-foreground"
          }`}
        >
          <span className="flex-1 font-medium">{toast.message}</span>
          {closeButton ? (
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              className="ml-auto text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Fechar
            </button>
          ) : null}
        </div>
      ))}
    </div>,
    document.body,
  );
}
