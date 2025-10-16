"use client";

import { useEffect, useMemo, useState } from "react";

import type { ChecklistItem, Service, ServiceUpdate } from "@/lib/types";

const STATUS_LABELS: Record<ChecklistItem["status"], string> = {
  nao_iniciado: "Não iniciado",
  andamento: "Em andamento",
  concluido: "Concluído",
};

const STATUS_OPTIONS: ChecklistItem["status"][] = ["nao_iniciado", "andamento", "concluido"];

type ServiceResponse = {
  ok: true;
  service: Service;
  checklist: ChecklistItem[];
  updates: ServiceUpdate[];
};

type ErrorResponse = { ok: false; error?: string };

type ChecklistDraft = Array<{
  id: string;
  description: string;
  weight: number;
  progress: number;
  status: ChecklistItem["status"];
}>;

type Props = {
  serviceId: string;
  token: string;
};

type ToastState = { type: "success" | "error"; message: string; id: number } | null;

function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatUpdateTimestamp(timestamp?: number) {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function computeWeightedProgress(items: ChecklistDraft): number {
  const totalWeight = items.reduce((acc, item) => acc + (Number(item.weight) || 0), 0);
  if (!totalWeight) return 0;
  const sum = items.reduce((acc, item) => acc + (Number(item.progress) || 0) * (Number(item.weight) || 0), 0);
  return Math.round((sum / totalWeight) * 10) / 10;
}

export default function ServiceClient({ serviceId, token }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ServiceResponse | null>(null);
  const [manualPercent, setManualPercent] = useState<string>("");
  const [manualNote, setManualNote] = useState("");
  const [checklistDraft, setChecklistDraft] = useState<ChecklistDraft>([]);
  const [checklistNote, setChecklistNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message, id: Date.now() });
  }

  useEffect(() => {
    if (!token) {
      setError("Token não informado. Inclua ?token=... na URL.");
      setData(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public/service?serviceId=${encodeURIComponent(serviceId)}&token=${encodeURIComponent(token)}`);
        const json = (await response.json()) as ServiceResponse | ErrorResponse;
        if (!response.ok || !json || json.ok === false) {
          const message = ("error" in json && json.error) ? json.error : "Falha ao carregar serviço";
          if (!cancelled) {
            setError(message);
            setData(null);
          }
          return;
        }
        if (!cancelled) {
          setData(json);
        }
      } catch (err: unknown) {
        console.error("[public/service] Falha ao carregar", err);
        if (!cancelled) {
          setError("Não foi possível carregar os dados do serviço.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [serviceId, token, refreshIndex]);

  useEffect(() => {
    if (!data) return;
    if (!data.service.hasChecklist) {
      setManualPercent((Number(data.service.realPercent ?? 0) || 0).toFixed(1));
    }
    setChecklistDraft(
      data.checklist.map((item) => ({
        id: item.id,
        description: item.description,
        weight: item.weight,
        progress: Number(item.progress ?? 0),
        status: item.status,
      })),
    );
  }, [data]);

  const checklistPreview = useMemo(() => computeWeightedProgress(checklistDraft), [checklistDraft]);

  function triggerReload() {
    setRefreshIndex((index) => index + 1);
  }

  async function submitManualUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const body = {
        percent: Number(manualPercent),
        note: manualNote.trim() ? manualNote.trim() : undefined,
      };
      const response = await fetch(
        `/api/public/service/update-manual?serviceId=${encodeURIComponent(serviceId)}&token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await response.json()) as { ok?: boolean; error?: string; realPercent?: number };
      if (!response.ok || json.ok === false) {
        throw new Error(json.error || "Falha ao salvar atualização");
      }
      showToast("success", "Atualização registrada com sucesso!");
      setManualNote("");
      triggerReload();
    } catch (err: unknown) {
      console.error("[update-manual] falha", err);
      const message = err instanceof Error ? err.message : "Não foi possível salvar a atualização.";
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function submitChecklistUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const payload = {
        updates: checklistDraft.map((item) => ({
          id: item.id,
          progress: Number(item.progress ?? 0),
          status: item.status,
        })),
        note: checklistNote.trim() ? checklistNote.trim() : undefined,
      };

      const response = await fetch(
        `/api/public/service/update-checklist?serviceId=${encodeURIComponent(serviceId)}&token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await response.json()) as { ok?: boolean; error?: string; realPercent?: number };
      if (!response.ok || json.ok === false) {
        throw new Error(json.error || "Falha ao salvar atualização");
      }
      showToast("success", "Atualização registrada com sucesso!");
      setChecklistNote("");
      triggerReload();
    } catch (err: unknown) {
      console.error("[update-checklist] falha", err);
      const message = err instanceof Error ? err.message : "Não foi possível salvar a atualização.";
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  function updateChecklistItem(id: string, patch: Partial<ChecklistDraft[number]>) {
    setChecklistDraft((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch, progress: Number(patch.progress ?? item.progress) } : item)),
    );
  }

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
        <section className="rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Acesso público</h1>
          <p className="mt-2 text-sm text-gray-600">Informe um token de acesso válido na URL para visualizar o serviço.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
      <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>

      <section className="rounded-lg border bg-background p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Serviço {serviceId}</h1>
          <p className="text-sm text-gray-600">Acompanhe e registre o avanço das atividades utilizando o token fornecido.</p>
        </div>
      </section>

      {loading && (
        <section className="rounded-lg border bg-background p-6 shadow-sm" role="status" aria-live="polite">
          <p className="text-sm text-gray-600">Carregando dados do serviço...</p>
        </section>
      )}

      {error && (
        <section className="rounded-lg border bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-600">Não foi possível carregar</h2>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button
            type="button"
            onClick={triggerReload}
            className="mt-4 inline-flex w-full min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-black px-4 text-center text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {data && !error && (
        <>
          <section className="space-y-4 rounded-lg border bg-background p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Informações gerais</h2>
              <p className="mt-1 text-sm text-gray-600">
                {data.service.equipmentName || "Equipamento não informado"}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-800">OS:</span> {data.service.os || "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Tag:</span> {data.service.tag || "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Setor:</span> {data.service.sector || "—"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Percentual concluído</span>
                <span className="text-base font-semibold text-foreground">
                  {formatPercent(data.service.realPercent)}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, Number(data.service.realPercent ?? 0)))}%` }}
                />
              </div>
            </div>
          </section>

          {data.service.hasChecklist ? (
            <section className="space-y-4 rounded-lg border bg-background p-6 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Atualizar checklist</h2>
                <p className="text-sm text-gray-600">Informe o avanço de cada item utilizando os controles abaixo.</p>
              </div>
              <form onSubmit={submitChecklistUpdate} className="space-y-4">
                <div className="space-y-3">
                  {checklistDraft.length === 0 && (
                    <div className="card p-6 text-sm text-muted-foreground">Nenhum item encontrado.</div>
                  )}
                  {checklistDraft.map((item) => (
                    <div key={item.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium text-foreground">{item.description || "Item sem descrição"}</span>
                        <span className="text-xs text-gray-500">Peso: {Number(item.weight ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Number(item.progress ?? 0)}
                          onChange={(event) =>
                            updateChecklistItem(item.id, { progress: Number(event.target.value) })
                          }
                          className="w-full"
                          aria-label={`Progresso do item ${item.description || item.id}`}
                        />
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          Progresso: {Number(item.progress ?? 0).toFixed(0)}%
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <label htmlFor={`status-${item.id}`} className="font-medium text-gray-700">
                          Status
                        </label>
                        <select
                          id={`status-${item.id}`}
                          value={item.status}
                          onChange={(event) =>
                            updateChecklistItem(item.id, {
                              status: event.target.value as ChecklistItem["status"],
                            })
                          }
                          className="w-full rounded-lg border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                          aria-label={`Status do item ${item.description || item.id}`}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                {checklistDraft.length > 0 && (
                  <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Prévia ponderada</span>
                      <span className="font-semibold">{formatPercent(checklistPreview)}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1 text-sm">
                  <label htmlFor="checklist-note" className="font-medium text-gray-700">
                    Nota (opcional)
                  </label>
                  <textarea
                    id="checklist-note"
                    value={checklistNote}
                    onChange={(event) => setChecklistNote(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    placeholder="Registre observações relevantes sobre esta atualização"
                    aria-label="Nota para atualização do checklist"
                  />
                </div>
                <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-gray-200 bg-gradient-to-t from-white via-white/95 to-white px-6 py-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex w-full min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar atualização"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="space-y-4 rounded-lg border bg-background p-6 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Atualizar progresso manual</h2>
                <p className="text-sm text-gray-600">Informe o percentual total concluído e uma nota opcional.</p>
              </div>
              <form onSubmit={submitManualUpdate} className="space-y-4">
                <div className="space-y-1 text-sm">
                  <label htmlFor="manual-percent" className="font-medium text-gray-700">
                    % total concluído
                  </label>
                  <input
                    id="manual-percent"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={manualPercent}
                    onChange={(event) => setManualPercent(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    placeholder="0 a 100"
                    required
                    aria-label="Percentual total concluído"
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <label htmlFor="manual-note" className="font-medium text-gray-700">
                    Nota (opcional)
                  </label>
                  <textarea
                    id="manual-note"
                    value={manualNote}
                    onChange={(event) => setManualNote(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    placeholder="Registre observações relevantes"
                    aria-label="Nota sobre o progresso manual"
                  />
                </div>
                <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-gray-200 bg-gradient-to-t from-white via-white/95 to-white px-6 py-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex w-full min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar atualização"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="space-y-3 rounded-lg border bg-background p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Histórico recente</h2>
              <span className="text-xs font-medium text-gray-500">Últimas {data.updates.length} entradas</span>
            </div>
            {data.updates.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhuma atualização registrada até o momento.</p>
            ) : (
              <ul className="space-y-3">
                {data.updates.map((update) => {
                  const percent = Number(update.manualPercent ?? update.realPercentSnapshot ?? 0);
                  return (
                    <li key={update.id} className="rounded-lg border px-4 py-3 text-sm">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">{formatPercent(percent)}</span>
                          <span className="text-xs text-gray-500">{formatUpdateTimestamp(update.createdAt)}</span>
                        </div>
                        {update.note && (
                          <p className="text-gray-700">{update.note}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
