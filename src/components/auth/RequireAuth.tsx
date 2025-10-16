"use client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/useAuth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && !user) router.replace("/login");
  }, [initializing, user, router]);

  if (initializing || !user) {
    return (
      <div className="container mx-auto grid min-h-[50vh] place-items-center px-4">
        <div className="card p-4 text-sm text-muted-foreground">
          <span className="spinner mr-2" /> Verificando acesso…
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
