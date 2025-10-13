'use client';

import { Suspense } from 'react';

import AcessoInner from './AcessoInner';

export const dynamic = 'force-dynamic'; // evita static render

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Carregando…</div>}>
      <AcessoInner />
    </Suspense>
  );
}
