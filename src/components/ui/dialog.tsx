"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(component: string) {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Dialog>`);
  }
  return context;
}

type DialogProps = {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const Dialog = ({ children, open: openProp, defaultOpen = false, onOpenChange }: DialogProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const contextValue = React.useMemo<DialogContextValue>(
    () => ({ open, setOpen, triggerRef }),
    [open, setOpen]
  );

  return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
};

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && typeof ref === "object") {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

type DialogTriggerProps = {
  asChild?: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

const DialogTrigger = React.forwardRef<HTMLElement, DialogTriggerProps>(
  ({ asChild = false, children, onClick, ...props }, forwardedRef) => {
    const { setOpen, open, triggerRef } = useDialogContext("DialogTrigger");
    const mergedRef = mergeRefs(forwardedRef, (node: HTMLElement | null) => {
      triggerRef.current = node;
    });

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        setOpen(true);
      }
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref: mergeRefs(children.ref as React.Ref<HTMLElement>, mergedRef),
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          if (typeof children.props.onClick === "function") {
            children.props.onClick(event);
          }
          handleClick(event);
        },
        "aria-haspopup": "dialog",
        "aria-expanded": open,
      });
    }

    return (
      <button
        type="button"
        {...props}
        ref={mergedRef as React.Ref<HTMLButtonElement>}
        onClick={(event) => handleClick(event)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = "DialogTrigger";

type DialogPortalProps = {
  children: React.ReactNode;
};

const DialogPortal = ({ children }: DialogPortalProps) => {
  const { open } = useDialogContext("DialogPortal");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) return null;

  return createPortal(children, document.body);
};

type DialogOverlayProps = React.HTMLAttributes<HTMLDivElement>;

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(
  ({ className, ...props }, ref) => {
    const { open } = useDialogContext("DialogOverlay");
    if (!open) return null;

    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
        data-state={open ? "open" : "closed"}
        aria-hidden="true"
      />
    );
  }
);
DialogOverlay.displayName = "DialogOverlay";

type DialogContentContextValue = {
  setTitleId: (id?: string) => void;
  setDescriptionId: (id?: string) => void;
};

const DialogContentContext = React.createContext<DialogContentContextValue | null>(null);

type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef } = useDialogContext("DialogContent");
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const mergedRef = mergeRefs(contentRef, forwardedRef);
    const [titleId, setTitleId] = React.useState<string>();
    const [descriptionId, setDescriptionId] = React.useState<string>();

    React.useEffect(() => {
      if (!open) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, setOpen]);

    React.useEffect(() => {
      if (!open) return;
      const node = contentRef.current;
      if (node) {
        node.focus({ preventScroll: true });
      }
    }, [open]);

    React.useEffect(() => {
      if (open) return;
      triggerRef.current?.focus();
    }, [open, triggerRef]);

    if (!open) return null;

    const contextValue = React.useMemo(
      () => ({
        setTitleId,
        setDescriptionId,
      }),
      []
    );

    return (
      <DialogPortal>
        <DialogOverlay
          onClick={() => {
            setOpen(false);
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          ref={mergedRef}
          tabIndex={-1}
          className={cn(
            "fixed z-50 grid w-full max-w-lg gap-4 rounded-2xl border",
            "bg-background p-6 shadow-lg",
            "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]",
            className
          )}
          data-state="open"
          {...props}
        >
          <DialogContentContext.Provider value={contextValue}>
            {children}
          </DialogContentContext.Provider>
          <DialogCloseButton />
        </div>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = "DialogContent";

type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement>;

const DialogHeader = ({ className, ...props }: DialogHeaderProps) => (
  <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

type DialogFooterProps = React.HTMLAttributes<HTMLDivElement>;

const DialogFooter = ({ className, ...props }: DialogFooterProps) => (
  <div className={cn("flex flex-row-reverse gap-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

type DialogTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, id, ...props }, ref) => {
    const autoId = React.useId();
    const { setTitleId } = React.useContext(DialogContentContext) ?? {};
    const finalId = id ?? autoId;

    React.useEffect(() => {
      setTitleId?.(finalId);
      return () => setTitleId?.(undefined);
    }, [setTitleId, finalId]);

    return (
      <h2
        ref={ref}
        id={finalId}
        className={cn("text-lg font-semibold leading-none tracking-tight", className)}
        {...props}
      />
    );
  }
);
DialogTitle.displayName = "DialogTitle";

type DialogDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, id, ...props }, ref) => {
    const autoId = React.useId();
    const { setDescriptionId } = React.useContext(DialogContentContext) ?? {};
    const finalId = id ?? autoId;

    React.useEffect(() => {
      setDescriptionId?.(finalId);
      return () => setDescriptionId?.(undefined);
    }, [setDescriptionId, finalId]);

    return (
      <p
        ref={ref}
        id={finalId}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      />
    );
  }
);
DialogDescription.displayName = "DialogDescription";

type DialogCloseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const DialogCloseButton = React.forwardRef<HTMLButtonElement, DialogCloseButtonProps>(
  ({ className, ...props }, ref) => {
    const { setOpen } = useDialogContext("DialogCloseButton");
    return (
      <button
        type="button"
        ref={ref}
        className={cn(
          "absolute right-4 top-4 rounded-md opacity-70 transition-opacity",
          "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring",
          className
        )}
        aria-label="Fechar"
        onClick={(event) => {
          props.onClick?.(event);
          if (!event.defaultPrevented) {
            setOpen(false);
          }
        }}
        {...props}
      >
        <X className="h-5 w-5" />
      </button>
    );
  }
);
DialogCloseButton.displayName = "DialogCloseButton";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
