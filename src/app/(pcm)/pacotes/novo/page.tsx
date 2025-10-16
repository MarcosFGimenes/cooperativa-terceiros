"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { Field } from "@/components/ui/form-controls";
import { getFirebaseFirestore } from "@/lib/firebaseClient";

export default function NovoPacotePage() {
  const db = useMemo(() => getFirebaseFirestore(), []);
  const router = useRouter();
  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [saving, setSaving] = useState(false);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do pacote.");
      return;
    }
    setSaving(true);
    try {
      const nome = form.nome.trim();
      const descricao = form.descricao.trim();
      const payload = {
        nome,
        name: nome,
        descricao: descricao || null,
        description: descricao || null,
        status: "Aberto",
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "packages"), payload);
      toast.success("Pacote criado com sucesso.");
      router.push(`/pacotes/${ref.id}`);
    } catch (error) {
      console.error("[pacotes/novo] Falha ao criar pacote", error);
      toast.error("Não foi possível criar o pacote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Novo pacote</h1>
        <Link className="btn-secondary" href="/pacotes">
          Cancelar
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border bg-card/80 p-6 shadow-sm">
        <Field label="Nome do pacote" value={form.nome} onChange={(event) => updateForm("nome", event.target.value)} required />
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground/90" htmlFor="descricao">
            Descrição
          </label>
          <textarea
            id="descricao"
            value={form.descricao}
            onChange={(event) => updateForm("descricao", event.target.value)}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <p className="text-xs text-muted-foreground">Texto livre para contextualizar o pacote.</p>
        </div>

        <button type="submit" className="btn-primary" aria-busy={saving} disabled={saving}>
          {saving ? "Salvando..." : "Salvar pacote"}
        </button>
      </form>
    </div>
  );
}
