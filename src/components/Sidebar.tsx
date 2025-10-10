"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Menu, PanelLeftClose, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAVIGATION = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Serviços",
    href: "/servicos",
    icon: Wrench,
  },
  {
    label: "Pacotes",
    href: "/pacotes",
    icon: Boxes,
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const normalized = useMemo(() => pathname.replace(/\/$/, ""), [pathname]);

  return (
    <nav aria-label="Menu principal" className="space-y-1">
      {NAVIGATION.map((item) => {
        const Icon = item.icon;
        const isActive =
          normalized === item.href || normalized.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={onNavigate}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="hidden w-64 shrink-0 border-r border-border bg-muted/20 p-6 backdrop-blur lg:block">
        <div className="space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Navegação
            </p>
            <SidebarNav />
          </div>

          <Card aria-live="polite">
            <CardHeader>
              <CardTitle className="text-base">Progresso do mês</CardTitle>
              <CardDescription>
                Insights rápidos para acompanhar seus contratos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Pacotes ativos</p>
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
              <div>
                <p className="text-sm font-medium">Ordens em andamento</p>
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky top-0 z-40 w-full border-b border-border bg-background p-2 lg:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
              Menu
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0 sm:max-w-sm">
            <DialogHeader className="sr-only">
              <DialogTitle>Navegação principal</DialogTitle>
              <DialogDescription>
                Escolha uma seção para navegar no painel PCM.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Menu</h2>
                <PanelLeftClose className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <SidebarNav onNavigate={() => setOpen(false)} />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumo rápido</CardTitle>
                  <CardDescription>
                    Indicadores serão exibidos aqui em breve.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
