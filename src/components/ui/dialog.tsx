import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/40 bg-background p-4 shadow-xl outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        {...props}
      />
    </DialogPortal>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2">{children}</div>;
}

export function DialogTitle(props: React.ComponentPropsWithoutRef<"h2">) {
  return <h2 className={cn("text-lg font-semibold", props.className)} {...props} />;
}

export function DialogDescription(props: React.ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-sm text-gray-600", props.className)} {...props} />;
}

export function DialogCloseIcon() {
  return (
    <DialogClose className="absolute right-3 top-3 p-1 rounded hover:bg-gray-100" aria-label="Fechar">
      <X className="h-4 w-4" />
    </DialogClose>
  );
}
