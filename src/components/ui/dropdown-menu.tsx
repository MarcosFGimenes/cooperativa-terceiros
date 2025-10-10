"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdown(component: string) {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error(`${component} deve ser usado dentro de <DropdownMenu>`);
  }
  return context;
}

interface DropdownMenuProps {
  children: React.ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);

  const value = React.useMemo(
    () => ({ open, setOpen, triggerRef }),
    [open]
  );

  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>;
}

interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

export function DropdownMenuTrigger({ asChild, children }: DropdownMenuTriggerProps) {
  const { setOpen, triggerRef, open } = useDropdown("DropdownMenuTrigger");
  const assignTriggerRef = React.useCallback((node: HTMLElement | null) => {
    triggerRef.current = node ?? null;
  }, [triggerRef]);

  const handleClick: React.MouseEventHandler = (event) => {
    children.props.onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(!open);
    }
  };

  const commonProps = {
    ref: assignTriggerRef,
    onClick: handleClick,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
  };

  if (asChild) {
    return React.cloneElement(children, commonProps);
  }

  return (
    <button type="button" {...commonProps}>
      {children}
    </button>
  );
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "start", style, children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdown("DropdownMenuContent");
    const [mounted, setMounted] = React.useState(false);
    const [position, setPosition] = React.useState<{ top: number; left: number }>({
      top: 0,
      left: 0,
    });

    React.useEffect(() => {
      setMounted(true);
    }, []);

    React.useEffect(() => {
      if (!open || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const horizontalOffset = align === "end" ? rect.right : rect.left;
      setPosition({
        top: rect.bottom + window.scrollY + 6,
        left: horizontalOffset + window.scrollX,
      });
    }, [open, align, triggerRef]);

    React.useEffect(() => {
      if (!open) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      };
      const onClick = (event: MouseEvent) => {
        if (triggerRef.current && event.target instanceof Node) {
          if (!triggerRef.current.contains(event.target)) {
            setOpen(false);
          }
        }
      };
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("mousedown", onClick);
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("mousedown", onClick);
      };
    }, [open, setOpen, triggerRef]);

    if (!mounted || !open) {
      return null;
    }

    return createPortal(
      <div
        ref={ref}
        role="menu"
        style={{
          position: "absolute",
          top: position.top,
          left: position.left,
          transform: align === "end" ? "translateX(-100%)" : undefined,
          minWidth: "8rem",
          ...style,
        }}
        className={cn(
          "z-50 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>,
      document.body
    );
  }
);
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold text-muted-foreground", className)}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("my-1 h-px bg-border", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, onClick, children, ...props }, ref) => {
    const { setOpen } = useDropdown("DropdownMenuItem");

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        setOpen(false);
      }
    };

    return (
      <button
        ref={ref}
        role="menuitem"
        className={cn(
          "flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-0.5", className)} {...props} />
);
DropdownMenuGroup.displayName = "DropdownMenuGroup";

export const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export const DropdownMenuCheckboxItem = DropdownMenuItem;
export const DropdownMenuRadioItem = DropdownMenuItem;
export const DropdownMenuPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DropdownMenuSub = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DropdownMenuSubTrigger = DropdownMenuItem;
export const DropdownMenuSubContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DropdownMenuRadioGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>;
