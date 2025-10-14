"use client";

import { FormEvent, useState } from "react";
import type { ServiceStatus } from "@/lib/types";

type Props = {
  serviceId: string;
  initial: {
    os: string;
    oc?: string;
    tag: string;
    equipmentName: string;
    sector: string;
    plannedStart: string;
    plannedEnd: string;
    totalHours: number;
    company?: string;
    status: ServiceStatus;
  };
};

const STATUS_OPTIONS: { value: ServiceStatus; label: string }[] = [
  { value: "aberto", label: "Aberto" },
  { value: "concluido", label: "Concluído" },
  { value: "encerrado", label: "Encerrado" },
];

export default function ServiceMetadataForm({ serviceId, initial }: Props) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField<T extends keyof typeof form>(field: T, value: (typeof form)[T]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/services/${serviceId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          os: form.os.trim(),
          oc: form.oc?.trim() || undefined,
          tag: form.tag.trim(),
          equipmentName: form.equipmentName.trim(),
          sector: form.sector.trim(),
          plannedStart: form.plannedStart,
          plannedEnd: form.plannedEnd,
          totalHours: Number(form.totalHours) || 0,
          company: form.company?.trim() || undefined,
          status: form.status,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar as alterações.");
      }

      setFeedback("Dados atualizados com sucesso.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">OS</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.os}
            onChange={(event) => updateField("os", event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">OC</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.oc ?? ""}
            onChange={(event) => updateField("oc", event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Tag</span>
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
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Setor</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.sector}
            onChange={(event) => updateField("sector", event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Empresa</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.company ?? ""}
            onChange={(event) => updateField("company", event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Início previsto</span>
          <input
            type="date"
            className="w-full rounded border px-3 py-2"
            value={form.plannedStart ?? ""}
            onChange={(event) => updateField("plannedStart", event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Término previsto</span>
          <input
            type="date"
            className="w-full rounded border px-3 py-2"
            value={form.plannedEnd ?? ""}
            onChange={(event) => updateField("plannedEnd", event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Horas totais</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border px-3 py-2"
            value={form.totalHours}
            onChange={(event) => updateField("totalHours", Number(event.target.value))}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Status</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={form.status}
            onChange={(event) => updateField("status", event.target.value as ServiceStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {feedback && <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</div>}
      {error && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">{error}</div>}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
