import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/ui/use-toast";

interface PcmLayoutProps {
  children: ReactNode;
}

export default function PcmLayout({ children }: PcmLayoutProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ToastProvider>
        <div className="flex min-h-screen bg-background text-foreground">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <Topbar title="PCM" />
            <main className="flex-1 pb-12 pt-6">
              <div className="container space-y-6">{children}</div>
            </main>
          </div>
        </div>
        <Toaster />
      </ToastProvider>
    </ThemeProvider>
  );
}
