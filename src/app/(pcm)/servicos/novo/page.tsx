"use client";

import { FormEvent, useMemo, useState } from "react";
import ChecklistItemsEditor, { ChecklistDraftItem } from "@/components/forms/ChecklistItemsEditor";

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

      setResult({ serviceId: data.serviceId, token: data.token, link });
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Novo serviço</h1>
        <p className="text-sm text-gray-600">
          Preencha os dados para criar um novo serviço. Gere tokens de acesso para terceiros automaticamente, se necessário.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">OS</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.os}
              onChange={(event) => updateField("os", event.target.value)}
              placeholder="Número da ordem de serviço"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">OC</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.oc}
              onChange={(event) => updateField("oc", event.target.value)}
              placeholder="Número da ordem de compra"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Tag do equipamento</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.tag}
              onChange={(event) => updateField("tag", event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Equipamento</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.equipmentName}
              onChange={(event) => updateField("equipmentName", event.target.value)}
              placeholder="Descrição do equipamento"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Setor</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.sector}
              onChange={(event) => updateField("sector", event.target.value)}
              placeholder="Setor responsável"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Empresa</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.company}
              onChange={(event) => updateField("company", event.target.value)}
              placeholder="Empresa executora"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Início previsto</span>
            <input
              type="date"
              className="w-full rounded border px-3 py-2"
              value={form.plannedStart}
              onChange={(event) => updateField("plannedStart", event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Término previsto</span>
            <input
              type="date"
              className="w-full rounded border px-3 py-2"
              value={form.plannedEnd}
              onChange={(event) => updateField("plannedEnd", event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Horas totais</span>
            <input
              type="number"
              min={1}
              className="w-full rounded border px-3 py-2"
              value={form.totalHours}
              onChange={(event) => updateField("totalHours", event.target.value)}
              placeholder="Quantidade de horas planejadas"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-gray-50 p-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useChecklist}
              onChange={(event) => {
                setUseChecklist(event.target.checked);
                if (!event.target.checked) {
                  setChecklistItems(initialChecklist);
                }
              }}
            />
            <span className="font-medium text-gray-700">Usar checklist?</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={generateToken}
              onChange={(event) => setGenerateToken(event.target.checked)}
            />
            <span className="font-medium text-gray-700">Gerar token de acesso para terceiros</span>
          </label>
        </div>

        {useChecklist && <ChecklistItemsEditor items={checklistItems} onChange={setChecklistItems} />}

        {error && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Limpar
          </button>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Criar serviço"}
          </button>
        </div>
      </form>

      {result && (
        <div className="rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-semibold">Serviço criado com sucesso!</p>
          <p className="mt-1">ID: {result.serviceId}</p>
          {result.token && <p className="mt-1">Token: {result.token}</p>}
          {result.link && (
            <p className="mt-1 truncate">
              Link: <a className="underline" href={result.link} target="_blank" rel="noreferrer">{result.link}</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
