"use client";

import { FormEvent, useMemo, useState } from "react";
import ChecklistItemsEditor, { ChecklistDraftItem } from "@/components/forms/ChecklistItemsEditor";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";

type ServiceResult = {
  serviceId: string;
  token?: string;
  link?: string;
};

type ChecklistPayload = {
  description: string;
  weight: number;
};

const initialChecklist: ChecklistDraftItem[] = [];

const initialForm = {
  os: "",
  oc: "",
  tag: "",
  equipmentName: "",
  sector: "",
  plannedStart: "",
  plannedEnd: "",
  totalHours: "",
  company: "",
};

export default function Page() {
  const [form, setForm] = useState(initialForm);
  const [useChecklist, setUseChecklist] = useState(false);
  const [generateToken, setGenerateToken] = useState(true);
  const [checklistItems, setChecklistItems] = useState<ChecklistDraftItem[]>(initialChecklist);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServiceResult | null>(null);

  const totalWeight = useMemo(
    () => Math.round(checklistItems.reduce((acc, item) => acc + (Number(item.weight) || 0), 0) * 100) / 100,
    [checklistItems],
  );

  const isChecklistValid = !useChecklist || Math.round(totalWeight) === 100;

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setUseChecklist(false);
    setChecklistItems(initialChecklist);
    setGenerateToken(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!form.os.trim()) {
      setError("Informe o número da OS.");
      return;
    }

    if (!form.tag.trim()) {
      setError("Informe a tag do equipamento.");
      return;
    }

    if (!form.equipmentName.trim()) {
      setError("Informe o nome do equipamento.");
      return;
    }

    if (!form.sector.trim()) {
      setError("Informe o setor responsável.");
      return;
    }

    if (!form.plannedStart || !form.plannedEnd) {
      setError("Informe as datas previstas de início e término.");
      return;
    }

    if (!form.totalHours || Number(form.totalHours) <= 0) {
      setError("Informe as horas totais previstas.");
      return;
    }

    if (!form.company.trim()) {
      setError("Informe a empresa executora.");
      return;
    }

    if (!isChecklistValid) {
      setError("A soma dos pesos do checklist deve ser igual a 100%.");
      return;
    }

    try {
      setSubmitting(true);

      const payload: Record<string, unknown> = {
        os: form.os.trim(),
        oc: form.oc.trim() || undefined,
        tag: form.tag.trim(),
        equipmentName: form.equipmentName.trim(),
        sector: form.sector.trim(),
        plannedStart: form.plannedStart,
        plannedEnd: form.plannedEnd,
        totalHours: Number(form.totalHours),
        company: form.company.trim(),
        useChecklist,
      };

      if (useChecklist) {
        const checklist: ChecklistPayload[] = checklistItems
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description.trim(),
            weight: Number(item.weight) || 0,
          }));
        payload.checklist = checklist;
      }

      if (generateToken) {
        payload.generateToken = true;
      }

      const response = await fetch("/api/admin/services/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<ServiceResult & { error?: string }>;

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível criar o serviço.");
      }

      if (!data.serviceId) {
        throw new Error("Resposta inesperada da API.");
      }

      const link =
        data.link && data.link.startsWith("http")
          ? data.link
          : data.link
          ? `${window.location.origin}${data.link}`
          : undefined;

      const nextResult = { serviceId: data.serviceId, token: data.token, link };
      setResult(nextResult);
      toast.success("Serviço criado com sucesso!");
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo serviço"
        description="Preencha os dados para criar um novo serviço e gerar o token de acesso para terceiros."
        actions={<BackButton />}
      />

      <div className="card p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="label">
              OS
              <input
                className="input mt-1"
                value={form.os}
                onChange={(event) => updateField("os", event.target.value)}
                placeholder="Número da ordem de serviço"
              />
            </label>

            <label className="label">
              OC
              <input
                className="input mt-1"
                value={form.oc}
                onChange={(event) => updateField("oc", event.target.value)}
                placeholder="Número da ordem de compra"
              />
            </label>

            <label className="label">
              Tag do equipamento
              <input
                className="input mt-1"
                value={form.tag}
                onChange={(event) => updateField("tag", event.target.value)}
                placeholder="TAG principal"
              />
            </label>

            <label className="label">
              Equipamento
              <input
                className="input mt-1"
                value={form.equipmentName}
                onChange={(event) => updateField("equipmentName", event.target.value)}
                placeholder="Descrição do equipamento"
              />
            </label>

            <label className="label">
              Setor responsável
              <input
                className="input mt-1"
                value={form.sector}
                onChange={(event) => updateField("sector", event.target.value)}
                placeholder="Setor responsável"
              />
            </label>

            <label className="label">
              Empresa executora
              <input
                className="input mt-1"
                value={form.company}
                onChange={(event) => updateField("company", event.target.value)}
                placeholder="Empresa executora"
              />
            </label>

            <label className="label">
              Início previsto
              <input
                type="date"
                className="input mt-1"
                value={form.plannedStart}
                onChange={(event) => updateField("plannedStart", event.target.value)}
              />
            </label>

            <label className="label">
              Término previsto
              <input
                type="date"
                className="input mt-1"
                value={form.plannedEnd}
                onChange={(event) => updateField("plannedEnd", event.target.value)}
              />
            </label>

            <label className="label">
              Horas totais
              <input
                type="number"
                min={1}
                className="input mt-1"
                value={form.totalHours}
                onChange={(event) => updateField("totalHours", event.target.value)}
                placeholder="Quantidade de horas planejadas"
              />
            </label>
          </div>

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4 text-sm">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={useChecklist}
                onChange={(event) => {
                  setUseChecklist(event.target.checked);
                  if (!event.target.checked) {
                    setChecklistItems(initialChecklist);
                  }
                }}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
              />
              Usar checklist de entregas
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={generateToken}
                onChange={(event) => setGenerateToken(event.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
              />
              Gerar token de acesso para terceiros automaticamente
            </label>
            {useChecklist ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Configure os itens abaixo. A soma dos pesos precisa totalizar 100% ({totalWeight.toFixed(1)}%).
              </p>
            ) : null}
          </div>

          {useChecklist ? <ChecklistItemsEditor items={checklistItems} onChange={setChecklistItems} /> : null}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={resetForm} className="btn-secondary" disabled={submitting}>
              {submitting ? "…" : "Limpar"}
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Salvando…" : "Criar serviço"}
            </button>
          </div>
        </form>

        {result ? (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm">
            <p className="font-semibold text-primary">Serviço criado com sucesso!</p>
            <p className="mt-1 text-muted-foreground">ID: {result.serviceId}</p>
            {result.token ? <p className="mt-1 text-muted-foreground">Token: {result.token}</p> : null}
            {result.link ? (
              <p className="mt-1 truncate text-muted-foreground">
                Link: <a className="link" href={result.link} target="_blank" rel="noreferrer">{result.link}</a>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
