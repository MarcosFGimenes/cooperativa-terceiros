import type { ReactNode } from "react";
import Link from "next/link";

export default function PcmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-page grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="card p-4 sticky top-4 h-max">
        <div className="text-sm font-semibold mb-3">Painel PCM</div>
        <nav className="space-y-2 text-sm">
          <Link className="block px-3 py-2 rounded-md hover:bg-accent" href="/(pcm)/dashboard">Dashboard</Link>
          <Link className="block px-3 py-2 rounded-md hover:bg-accent" href="/(pcm)/servicos/novo">Novo serviço</Link>
          <Link className="block px-3 py-2 rounded-md hover:bg-accent" href="/(pcm)/servicos">Serviços</Link>
          <Link className="block px-3 py-2 rounded-md hover:bg-accent" href="/(pcm)/pacotes">Pacotes</Link>
        </nav>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
