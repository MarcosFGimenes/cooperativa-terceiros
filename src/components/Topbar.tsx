"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Bell, Moon, Search, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";

interface TopbarProps {
  title?: string;
}

export function Topbar({ title = "PCM" }: TopbarProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { toast: pushToast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = (resolvedTheme ?? theme) === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    pushToast({
      title: "Tema atualizado",
      description: `Você agora está usando o tema ${nextTheme === "dark" ? "escuro" : "claro"}.`,
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex items-center gap-4 py-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex shrink-0 items-center gap-3">
            <Card className="flex h-10 w-10 items-center justify-center rounded-full border-none bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </Card>
            <h1 className="text-lg font-semibold leading-tight md:text-xl" aria-live="polite">
              {title}
            </h1>
          </div>
          <div className="hidden flex-1 items-center gap-2 sm:flex">
            <label htmlFor="pcm-search" className="sr-only">
              Buscar
            </label>
            <div className="relative flex w-full max-w-sm items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="pcm-search"
                type="search"
                placeholder="Buscar serviços, pacotes ou pessoas"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Alternar tema"
          >
            {mounted && (resolvedTheme ?? theme) === "dark" ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>

          <Button type="button" variant="ghost" size="icon" aria-label="Abrir notificações">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 px-3">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  aria-hidden="true"
                >
                  VP
                </span>
                <span className="hidden text-sm font-medium sm:inline">Você</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Perfil</DropdownMenuItem>
              <DropdownMenuItem>Configurações</DropdownMenuItem>
              <DropdownMenuItem>Central de ajuda</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
