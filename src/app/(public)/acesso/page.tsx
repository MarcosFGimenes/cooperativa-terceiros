import { Suspense } from "react";
import { AccessHandler } from "./access-handler";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Processando token…</div>}>
      <AccessHandler />
    </Suspense>
  );
}
