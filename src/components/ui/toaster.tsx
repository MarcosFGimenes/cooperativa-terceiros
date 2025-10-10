"use client";

import { Toast, ToastDescription, ToastTitle, ToastViewport } from "./toast";
import { useToast, useToastState } from "./use-toast";

export function Toaster() {
  const { toasts } = useToastState();
  const { dismiss } = useToast();

  return (
    <ToastViewport>
      {toasts.map(({ id, title, description, action }) => (
        <Toast key={id} onDismiss={() => dismiss(id)} action={action}>
          {title && <ToastTitle>{title}</ToastTitle>}
          {description && <ToastDescription>{description}</ToastDescription>}
        </Toast>
      ))}
    </ToastViewport>
  );
}
