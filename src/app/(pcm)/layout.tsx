import type { ReactNode } from "react";
import RequireAuth from "@/components/auth/RequireAuth";

export const dynamic = "force-dynamic";

export default function PcmLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
