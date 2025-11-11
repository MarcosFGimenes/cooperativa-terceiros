"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { Field, FormRow } from "@/components/ui/form-controls";
import { tryGetFirestore } from "@/lib/firebase";
import { recordTelemetry } from "@/lib/telemetry";
import { resolveReopenedProgress, snapshotBeforeConclusion } from "@/lib/serviceProgress";

type ChecklistDraft = Array<{ id: string; descricao: string; peso: number | "" }>;

type PackageOption = { id: string; nome: string };

type UpdateHistoryItem = {
  id: string;
  date: Date | null;
  note?: string;
  totalPct?: number;
  items?: Array<{ itemId: string; pct: number }>;
};

const STATUS_OPTIONS = ["Aberto", "Pendente", "Concluído"] as const;

function toFormStatus(value: unknown): (typeof STATUS_OPTIONS)[number] {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "pendente") return "Pendente";
  if (raw === "concluido" || raw === "concluído" || raw === "encerrado") return "Concluído";
  return "Aberto";
}

function createChecklistId(seed: number) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `item-${seed}-${Date.now()}`;
}

function normaliseChecklistEntry(entry: unknown, index: number): ChecklistDraft[number] {
  const fallbackId = createChecklistId(index);
  if (!entry || typeof entry !== "object") {
    return { id: fallbackId, descricao: "", peso: 0 };
  }
  const record = entry as Record<string, unknown>;
  const idSource = record.id ?? record.itemId;
  const descricaoSource = record.descricao ?? record.description;
  const pesoSource = record.peso ?? record.weight;

  const id = typeof idSource === "string" && idSource ? idSource : fallbackId;
  const descricao = typeof descricaoSource === "string" ? descricaoSource : "";
  const pesoValue = typeof pesoSource === "number" ? pesoSource : Number(pesoSource ?? 0);

  return { id, descricao, peso: Number.isFinite(pesoValue) ? pesoValue : 0 };
}

function toDateInput(value: unknown): string {
  if (!value) return "";
  if (value instanceof Timestamp) {
    const date = value.toDate();
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value) {
    return value.slice(0, 10);
  }
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }
  return "";
}

function toTimestamp(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
}

type ServiceEditorClientProps = {
  serviceId: string;
};

export default function ServiceEditorClient({ serviceId }: ServiceEditorClientProps) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    os: "",
    oc: "",
    tag: "",
    equipamento: "",
    setor: "",
    dataInicio: "",
    dataFim: "",
    horasPrevistas: "",
    empresaId: "",
    status: "Aberto" as (typeof STATUS_OPTIONS)[number],
    pacoteId: "",
  });
  const [andamento, setAndamento] = useState(0);
  const [previousProgress, setPreviousProgress] = useState<number | null>(null);
  const [withChecklist, setWithChecklist] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistDraft>([]);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updates, setUpdates] = useState<UpdateHistoryItem[]>([]);
  const { db: firestore, error: firestoreError } = useMemo(() => tryGetFirestore(), []);

  useEffect(() => {
    if (firestoreError) {
      console.error("[servicos/:id] Firestore indisponível", firestoreError);
      toast.error("Configuração de banco de dados indisponível.");
    }
  }, [firestoreError]);

  const totalPeso = useMemo(
    () =>
      checklist.reduce((acc, item) => {
        const numeric = Number(item.peso);
        if (!Number.isFinite(numeric)) return acc;
        return acc + Math.max(0, Math.min(100, numeric));
      }, 0),
    [checklist],
  );

  useEffect(() => {
    if (!firestore) return;
    setLoadingPackages(true);
    getDocs(query(collection(firestore, "packages"), orderBy("nome", "asc")))
      .then((snapshot) => {
        const result: PackageOption[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() ?? {};
          return { id: docSnap.id, nome: String(data.nome ?? data.name ?? "") };
        });
        setPackages(result);
      })
      .catch((error) => {
        console.error("[servicos/:id] Falha ao carregar pacotes", error);
        toast.error("Não foi possível carregar os pacotes disponíveis.");
      })
      .finally(() => setLoadingPackages(false));
  }, [firestore]);

  useEffect(() => {
    let cancelled = false;
    if (!firestore) return;

    async function loadUpdates() {
      setUpdatesLoading(true);
      try {
        const ref = doc(firestore, "services", serviceId);
        const updatesRef = collection(ref, "serviceUpdates");
        const snap = await getDocs(query(updatesRef, orderBy("date", "desc"), limit(25)));
        const mapped: UpdateHistoryItem[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() ?? {};
          let date: Date | null = null;
          if (data.date instanceof Timestamp) {
            date = data.date.toDate();
          } else if (data.date && typeof data.date.toDate === "function") {
            date = data.date.toDate();
          }
          return {
            id: docSnap.id,
            date,
            note: data.note ?? undefined,
            totalPct: typeof data.totalPct === "number" ? data.totalPct : undefined,
            items: Array.isArray(data.items) ? data.items : undefined,
          };
        });
        if (!cancelled) setUpdates(mapped);
      } catch (error) {
        console.error("[servicos/:id] Falha ao carregar histórico", error);
        if (!cancelled) toast.error("Não foi possível carregar o histórico de atualizações.");
      } finally {
        if (!cancelled) setUpdatesLoading(false);
      }
    }

    async function load() {
      setLoading(true);
      try {
        const ref = doc(firestore, "services", serviceId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          toast.error("Serviço não encontrado.");
          return;
        }
        if (cancelled) return;

        const data = snap.data() ?? {};
        setForm({
          os: String(data.os ?? ""),
          oc: String(data.oc ?? ""),
          tag: String(data.tag ?? ""),
          equipamento: String(data.equipamento ?? data.equipmentName ?? ""),
          setor: String(data.setor ?? ""),
          dataInicio: toDateInput(data.inicioPrevisto),
          dataFim: toDateInput(data.fimPrevisto),
          horasPrevistas: data.horasPrevistas ? String(data.horasPrevistas) : "",
          empresaId: String(data.empresaId ?? data.company ?? ""),
          status: toFormStatus(data.status),
          pacoteId: String(data.pacoteId ?? data.packageId ?? ""),
        });
        const checklistData = Array.isArray(data.checklist) ? data.checklist : [];
        setChecklist(checklistData.map((item, index) => normaliseChecklistEntry(item, index)));
        setWithChecklist(checklistData.length > 0);
        setAndamento(Number(data.andamento ?? data.realPercent ?? 0));
        const prevProgressValue = Number(data.previousProgress ?? data.progressBeforeConclusion ?? data.previousPercent ?? NaN);
        setPreviousProgress(Number.isFinite(prevProgressValue) ? prevProgressValue : null);
        await loadUpdates();
      } catch (error) {
        console.error("[servicos/:id] Falha ao carregar serviço", error);
        toast.error("Não foi possível carregar os dados do serviço.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [firestore, serviceId]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateChecklistItem(id: string, patch: Partial<ChecklistDraft[number]>) {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeChecklistItem(id: string) {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  }

  function addChecklistItem() {
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11);
    setChecklist((prev) => [...prev, { id, descricao: "", peso: "" }]);
    setWithChecklist(true);
  }

  async function saveChanges() {
    if (!form.os.trim() || !form.tag.trim() || !form.equipamento.trim()) {
      toast.error("Preencha os campos obrigatórios (O.S, Tag e Equipamento).");
      return;
    }
    if (!form.dataInicio || !form.dataFim) {
      toast.error("Informe as datas de início e término previstas.");
      return;
    }
    const horas = Number(form.horasPrevistas);
    if (!Number.isFinite(horas) || horas <= 0) {
      toast.error("Horas previstas deve ser um número maior que zero.");
      return;
    }
    if (withChecklist && checklist.length > 0 && Math.round(totalPeso) !== 100) {
      toast.error("A soma dos pesos do checklist deve ser 100%.");
      return;
    }

    if (!firestore) {
      toast.error("Banco de dados indisponível.");
      return;
    }

    setSaving(true);
    try {
      const ref = doc(firestore, "services", serviceId);
      const payload = {
        os: form.os.trim(),
        oc: form.oc.trim() || null,
        tag: form.tag.trim(),
        equipamento: form.equipamento.trim(),
        equipmentName: form.equipamento.trim(),
        setor: form.setor.trim() || null,
        inicioPrevisto: toTimestamp(form.dataInicio),
        fimPrevisto: toTimestamp(form.dataFim),
        horasPrevistas: horas,
        empresaId: form.empresaId.trim() || null,
        company: form.empresaId.trim() || null,
        status: form.status,
        pacoteId: form.pacoteId || null,
        packageId: form.pacoteId || null,
        checklist: withChecklist
          ? checklist.map((item) => ({
              id: item.id,
              descricao: item.descricao.trim(),
              peso: Math.max(0, Math.min(100, Number(item.peso) || 0)),
            }))
          : [],
        updatedAt: serverTimestamp(),
      };
      await updateDoc(ref, payload);
      toast.success("Serviço atualizado com sucesso.");
    } catch (error) {
      console.error("[servicos/:id] Falha ao salvar", error);
      toast.error("Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: (typeof STATUS_OPTIONS)[number], progresso?: number) {
    if (!firestore) {
      toast.error("Banco de dados indisponível.");
      return;
    }
    setSaving(true);
    try {
      const ref = doc(firestore, "services", serviceId);
      const payload: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      let nextProgress: number | null = null;
      const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
      const currentProgress = Number.isFinite(andamento) ? clamp(andamento) : 0;

      if (status === "Concluído") {
        const snapshot = snapshotBeforeConclusion(currentProgress, previousProgress);
        payload.previousProgress = snapshot;
        payload.andamento = 100;
        payload.realPercent = 100;
        nextProgress = 100;
        setPreviousProgress(snapshot);
        recordTelemetry("service.progress.snapshot", { serviceId, progress: snapshot });
      } else if (status === "Pendente") {
        const history = updates
          .map((item) => (typeof item.totalPct === "number" ? item.totalPct : null))
          .filter((value): value is number => Number.isFinite(value ?? NaN));
        const target = resolveReopenedProgress({
          requested: typeof progresso === "number" ? progresso : null,
          previousStored: previousProgress,
          history,
          current: andamento,
        });
        payload.andamento = target;
        payload.previousProgress = target;
        payload.realPercent = target;
        nextProgress = target;
        setPreviousProgress(target);
        recordTelemetry("service.progress.restore", { serviceId, restored: target });
      } else if (typeof progresso === "number" && Number.isFinite(progresso)) {
        payload.andamento = clamp(progresso);
        payload.realPercent = clamp(progresso);
        nextProgress = clamp(progresso);
      }

      await updateDoc(ref, payload);
      setForm((prev) => ({ ...prev, status }));
      if (nextProgress !== null) {
        setAndamento(nextProgress);
      }
      toast.success("Status atualizado.");
    } catch (error) {
      console.error("[servicos/:id] Falha ao alterar status", error);
      toast.error("Não foi possível alterar o status.");
    } finally {
      setSaving(false);
    }
  }

  if (!firestore) {
    return (
      <div className="grid gap-6">
        <div className="rounded-2xl border bg-card/80 p-6 text-sm text-amber-600 shadow-sm">
          Não foi possível carregar o banco de dados. Verifique a configuração do Firebase.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
        {loading ? (
          <div className="space-y-4">
            <div className="h-6 w-3/4 animate-pulse rounded bg-muted/50" />
            <div className="h-40 animate-pulse rounded bg-muted/40" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Dados gerais</h2>
                <p className="text-sm text-muted-foreground">
                  Atualize os campos do serviço e gerencie o checklist utilizado nas medições.
                </p>
              </div>
              <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
                Andamento atual: <span className="font-semibold text-primary">{Math.round(andamento)}%</span>
              </div>
            </div>

            <FormRow>
              <Field label="O.S" value={form.os} onChange={(event) => updateForm("os", event.target.value)} required />
              <Field label="O.C" value={form.oc} onChange={(event) => updateForm("oc", event.target.value)} />
            </FormRow>
            <FormRow>
              <Field label="Tag" value={form.tag} onChange={(event) => updateForm("tag", event.target.value)} required />
              <Field
                label="Equipamento"
                value={form.equipamento}
                onChange={(event) => updateForm("equipamento", event.target.value)}
                required
              />
            </FormRow>
            <FormRow>
              <Field label="Setor" value={form.setor} onChange={(event) => updateForm("setor", event.target.value)} />
              <Field
                label="Empresa"
                value={form.empresaId}
                onChange={(event) => updateForm("empresaId", event.target.value)}
              />
            </FormRow>
            <FormRow>
              <Field
                label="Data de início prevista"
                type="date"
                value={form.dataInicio}
                onChange={(event) => updateForm("dataInicio", event.target.value)}
                required
              />
              <Field
                label="Data de término prevista"
                type="date"
                value={form.dataFim}
                onChange={(event) => updateForm("dataFim", event.target.value)}
                required
              />
            </FormRow>
            <FormRow>
              <Field
                label="Horas previstas"
                type="number"
                min={0}
                step="0.5"
                value={form.horasPrevistas}
                onChange={(event) => updateForm("horasPrevistas", event.target.value)}
                required
              />
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground/90" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value as (typeof STATUS_OPTIONS)[number])}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </FormRow>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90" htmlFor="pacote">
                Pacote
              </label>
              <select
                id="pacote"
                value={form.pacoteId}
                onChange={(event) => updateForm("pacoteId", event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                disabled={loadingPackages}
              >
                <option value="">Nenhum pacote</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.nome || `Pacote ${pkg.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-dashed bg-muted/20 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground/90">
                <input
                  type="checkbox"
                  checked={withChecklist}
                  onChange={(event) => setWithChecklist(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Utilizar checklist para este serviço
              </label>

              {withChecklist ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Itens do checklist</span>
                    <button type="button" onClick={addChecklistItem} className="btn btn-secondary text-xs">
                      Adicionar item
                    </button>
                  </div>
                  {checklist.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhum item cadastrado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {checklist.map((item) => (
                        <div key={item.id} className="rounded-lg border bg-background p-4 shadow-sm">
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="flex-1">
                              <label
                                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                htmlFor={`desc-${item.id}`}
                              >
                                Descrição
                              </label>
                              <textarea
                                id={`desc-${item.id}`}
                                value={item.descricao}
                                onChange={(event) => updateChecklistItem(item.id, { descricao: event.target.value })}
                                rows={2}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                              />
                            </div>
                            <div className="w-full sm:w-40">
                              <label
                                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                htmlFor={`peso-${item.id}`}
                              >
                                Peso (%)
                              </label>
                              <input
                                id={`peso-${item.id}`}
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={item.peso === "" ? "" : item.peso}
                                onChange={(event) => {
                                  const raw = event.target.value;
                                  if (raw === "") {
                                    updateChecklistItem(item.id, { peso: "" });
                                    return;
                                  }
                                  const parsed = Number(raw);
                                  if (!Number.isFinite(parsed)) return;
                                  const clamped = Math.max(0, Math.min(100, parsed));
                                  updateChecklistItem(item.id, { peso: clamped });
                                }}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                              />
                            </div>
                          </div>
                          <div className="mt-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(item.id)}
                              className="text-xs font-medium text-destructive hover:underline"
                            >
                              Remover item
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border bg-background/60 p-3 text-sm">
                    <div className="flex items-center justify-between font-medium">
                      <span>Soma dos pesos</span>
                      <span className={Math.round(totalPeso) === 100 ? "text-primary" : "text-amber-600"}>
                        {totalPeso.toFixed(1)}%
                      </span>
                    </div>
                    {Math.round(totalPeso) !== 100 ? (
                      <p className="mt-1 text-xs text-amber-600">A soma precisa atingir 100%.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={saveChanges}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => changeStatus("Concluído", 100)}
                  disabled={saving}
                >
                  Concluir serviço
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => changeStatus("Pendente")}
                  disabled={saving}
                >
                  Marcar como pendente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Histórico de atualizações</h2>
        {updatesLoading ? (
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
          </div>
        ) : updates.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma atualização registrada até o momento.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {updates.map((update) => (
              <li key={update.id} className="rounded-lg border bg-background p-4 shadow-sm">
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-foreground">
                    {update.date
                      ? update.date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                      : "Data não informada"}
                  </span>
                  {typeof update.totalPct === "number" ? (
                    <span className="text-xs text-muted-foreground">Percentual total: {Math.round(update.totalPct)}%</span>
                  ) : null}
                  {Array.isArray(update.items) && update.items.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Itens: {update.items.map((item) => `${item.itemId}: ${Math.round(item.pct)}%`).join(", ")}
                    </div>
                  ) : null}
                  {update.note ? <p className="text-sm text-muted-foreground">{update.note}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
