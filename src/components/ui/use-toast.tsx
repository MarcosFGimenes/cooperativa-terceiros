"use client";

import * as React from "react";

export type ToastRecord = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  duration?: number;
};

type ToastContextValue = {
  toasts: ToastRecord[];
  toast: (toast: Omit<ToastRecord, "id"> & { id?: string }) => { id: string; dismiss: () => void };
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = React.useCallback((id: string) => {
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = React.useCallback((id: string) => {
    clearTimer(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, [clearTimer]);

  type ToastCreator = ToastContextValue["toast"];

  const createToast = React.useCallback<ToastCreator>(
    ({ id: providedId, duration = 4000, ...props }) => {
      const id = providedId ?? Math.random().toString(36).slice(2);
      setToasts((current) => {
        const withoutExisting = current.filter((toast) => toast.id !== id);
        return [...withoutExisting, { ...props, id, duration }];
      });

      clearTimer(id);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => {
            dismiss(id);
          }, duration)
        );
      }

      return {
        id,
        dismiss: () => dismiss(id),
      };
    },
    [dismiss, clearTimer]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts, toast: createToast, dismiss }),
    [toasts, createToast, dismiss]
  );

  React.useEffect(() => {
    const timerStore = timers.current;
    return () => {
      timerStore.forEach((timer) => clearTimeout(timer));
      timerStore.clear();
    };
  }, []);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  }
  return context;
}

export function useToastState() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToastState deve ser usado dentro de <ToastProvider>");
  }
  return { toasts: context.toasts };
}
