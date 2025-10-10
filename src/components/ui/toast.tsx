"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  onDismiss?: () => void;
  action?: React.ReactNode;
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, children, action, onDismiss, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        className={cn(
          "group relative flex w-full items-start gap-3 overflow-hidden rounded-md border border-border bg-background p-4 shadow-lg pointer-events-auto",
          className
        )}
        {...props}
      >
        <div className="flex-1 space-y-1 text-sm">{children}</div>
        {action}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }
);
Toast.displayName = "Toast";

export const ToastTitle = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-sm font-semibold", className)} {...props} />
);
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);
ToastDescription.displayName = "ToastDescription";

export const ToastViewport = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3 sm:bottom-4 sm:top-auto",
        className
      )}
      role="region"
      aria-live="polite"
      aria-atomic="true"
      {...props}
    >
      {children}
    </div>
  )
);
ToastViewport.displayName = "ToastViewport";
