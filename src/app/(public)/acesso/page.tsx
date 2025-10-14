import { Suspense } from "react";
import { AcessoClient } from "./ui/AcessoClient";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <AcessoClient />
    </Suspense>
  );
}
