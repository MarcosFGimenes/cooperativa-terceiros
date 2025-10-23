"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Field, RangeItem } from "@/components/ui/form-controls";

type ValidateSuccess =
  | {
      ok: true;
      found: false;
    }
  | {
      ok: true;
      found: true;
      serviceIds: string[];
    };

type ValidateError = { ok: false; error: string };

type ChecklistEntry = {
  id: string;
  description: string;
  weight: number;
  progress: number;
};

type ServiceSummary = {
  id: string;
  os: string;
  tag: string;
  equipamento: string;
  andamento: number;
  status: string;
  hasChecklist: boolean;
  checklist: ChecklistEntry[];
};

type PublicServiceResponse = {
  ok: true;
  service: {
    id: string;
    os: string;
    tag: string;
    equipmentName: string;
    status: string;
    realPercent?: number;
    hasChecklist?: boolean;
  };
  checklist: Array<{ id: string; description: string; weight: number; progress: number }>;
};

type PublicServiceError = { ok: false; error?: string };

function formatPercent(value: number | undefined) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(Number(value ?? 0))}%`;
}

export default function AcessoPorTokenPage() {
  const qp = useSearchParams();
  const initial = useMemo(() => (qp?.get("token") ?? "").trim().toUpperCase(), [qp]);
  const router = useRouter();
  const [token, setToken] = useState(initial);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedToken, setValidatedToken] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [manualPercent, setManualPercent] = useState<string>("");
  const [checklistValues, setChecklistValues] = useState<Record<string, number>>({});
  const [savingUpdate, setSavingUpdate] = useState(false);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  useEffect(() => {
    setToken(initial);
    if (initial) {
      void onValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    if (!selectedService) {
      setManualPercent("");
      setChecklistValues({});
      return;
    }

    if (selectedService.hasChecklist && selectedService.checklist.length > 0) {
      const next: Record<string, number> = {};
      selectedService.checklist.forEach((item) => {
        next[item.id] = Number.isFinite(item.progress) ? Math.round(item.progress) : 0;
      });
      setChecklistValues(next);
      setManualPercent("");
    } else {
      setManualPercent(Math.round(selectedService.andamento ?? 0).toString());
      setChecklistValues({});
    }
  }, [selectedService]);

  async function fetchService(tokenValue: string, serviceId: string): Promise<ServiceSummary | null> {
    try {
      const response = await fetch(
        `/api/public/service?serviceId=${encodeURIComponent(serviceId)}&token=${encodeURIComponent(tokenValue)}`,
        { cache: "no-store" },
      );
      const json: PublicServiceResponse | PublicServiceError = await response.json();
      if (!response.ok || !json || json.ok === false) {
        return null;
      }
      const { service, checklist } = json;
      const status = service.status ?? "";
      const andamento = Number.isFinite(service.realPercent) ? Number(service.realPercent ?? 0) : 0;
      return {
        id: service.id,
        os: service.os,
        tag: service.tag,
        equipamento: service.equipmentName,
        andamento,
        status,
        hasChecklist: Boolean(service.hasChecklist && checklist.length > 0),
        checklist: checklist.map((item) => ({
          id: item.id,
          description: item.description,
          weight: Number(item.weight ?? 0),
          progress: Number(item.progress ?? 0),
        })),
      };
    } catch (error) {
      console.error("[acesso] Falha ao carregar serviço", error);
      return null;
    }
  }

  async function loadServices(tokenValue: string, serviceIds: string[]) {
    setLoadingServices(true);
    try {
      const entries = await Promise.all(serviceIds.map((id) => fetchService(tokenValue, id)));
      const onlyOpen = entries
        .filter((service): service is ServiceSummary => Boolean(service))
        .filter((service) => (service.status || "").toLowerCase() === "aberto");
      setServices(onlyOpen);
      if (onlyOpen.length > 0) {
        setSelectedServiceId(onlyOpen[0].id);
      } else {
        setSelectedServiceId(null);
      }
    } finally {
      setLoadingServices(false);
    }
  }

  async function onValidate(e?: FormEvent) {
    e?.preventDefault();
    const code = token.trim().toUpperCase();
    if (!code) return;
    setValidating(true);
    setValidationError(null);
    setServices([]);
    setSelectedServiceId(null);
    try {
      const response = await fetch(`/api/validate-token?token=${encodeURIComponent(code)}`, { cache: "no-store" });
      const json: ValidateSuccess | ValidateError = await response.json();
      if (!response.ok || !json || json.ok === false) {
        setValidatedToken(null);
        toast.error("Token inválido ou expirado.");
        setValidationError("Token inválido ou expirado.");
        return;
      }

      if (json.ok && json.found) {
        await fetch("/api/token-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: code }),
        });
        toast.success("Token válido! Redirecionando…");
        router.replace("/terceiro");
        return;
      }

      if (!json.found || ("serviceIds" in json && json.serviceIds.length === 0)) {
        setValidatedToken(code);
        toast.info("Token válido, mas nenhum serviço aberto foi encontrado.");
        setValidationError("Nenhum serviço aberto encontrado para este token.");
        return;
      }

      setValidatedToken(code);
      toast.success("Token validado. Selecione um serviço para atualizar.");
      const ids = "serviceIds" in json ? json.serviceIds : [];
      await loadServices(code, ids);
    } catch (error) {
      console.error("[acesso] Falha ao validar token", error);
      setValidatedToken(null);
      toast.error("Falha ao validar token.");
      setValidationError("Não foi possível validar o token no momento.");
    } finally {
      setValidating(false);
    }
  }

  function updateChecklistValue(id: string, value: number) {
    setChecklistValues((prev) => ({ ...prev, [id]: Math.max(0, Math.min(100, Math.round(value))) }));
  }

  async function refreshService(serviceId: string) {
    if (!validatedToken) return;
    const updated = await fetchService(validatedToken, serviceId);
    if (!updated) return;
    setServices((prev) => prev.map((service) => (service.id === serviceId ? updated : service)));
    if (selectedServiceId === serviceId) {
      setSelectedServiceId(serviceId);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validatedToken || !selectedService) return;

    if (selectedService.hasChecklist && selectedService.checklist.length > 0) {
      const itemsPayload = selectedService.checklist.map((item) => ({
        itemId: item.id,
        pct: Math.max(0, Math.min(100, Number(checklistValues[item.id] ?? 0))),
      }));
      const body = {
        token: validatedToken,
        serviceId: selectedService.id,
        items: itemsPayload,
        note: note.trim() ? note.trim() : undefined,
      };
      await sendUpdate(body);
    } else {
      const pct = Math.max(0, Math.min(100, Number(manualPercent || 0)));
      const body = {
        token: validatedToken,
        serviceId: selectedService.id,
        totalPct: pct,
        note: note.trim() ? note.trim() : undefined,
      };
      await sendUpdate(body);
    }
    await refreshService(selectedService.id);
  }

  async function sendUpdate(body: Record<string, unknown>) {
    setSavingUpdate(true);
    try {
      const response = await fetch("/api/progresso/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error ? String(errorBody.error) : "Falha ao enviar atualização.";
        toast.error(message);
        return;
      }
      toast.success("Atualização registrada com sucesso.");
      setNote("");
    } catch (error) {
      console.error("[acesso] Falha ao enviar atualização", error);
      toast.error("Não foi possível enviar a atualização.");
    } finally {
      setSavingUpdate(false);
    }
  }

  return (
    <div className="container-page max-w-4xl pb-16">
      <Link href="/" className="link inline-flex items-center gap-1 mb-4">
        ← Voltar
      </Link>

      <div className="mt-4 card bg-card/60 p-6 shadow-sm backdrop-blur">
        <h1 className="mb-1">Acesso do Terceiro</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Informe o código recebido para visualizar seus serviços e registrar o andamento.
        </p>

        <form onSubmit={onValidate} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium text-foreground/90">
              Código do token
            </label>
            <input
              id="token"
              name="token"
              value={token}
              onChange={(event) => setToken(event.target.value.toUpperCase())}
              placeholder="EX: RFHX9T86"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={Boolean(validationError)}
              className="input"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary h-11 px-5 sm:ml-3"
            aria-busy={validating}
            disabled={validating || !token}
          >
            {validating ? "Validando..." : "Validar token"}
          </button>
        </form>
        {validationError ? <p className="mt-2 text-sm text-amber-600">{validationError}</p> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Serviços abertos</h2>
            <div className="space-y-2">
              {loadingServices ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Carregando serviços...</div>
              ) : services.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum serviço disponível no momento.
                </div>
              ) : (
                services.map((service) => {
                  const isActive = service.id === selectedServiceId;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`btn btn-outline min-h-[44px] w-full flex flex-col items-start gap-1 text-left py-3 ${
                        isActive ? "border-primary bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex w-full items-center justify-between text-sm font-semibold">
                        <span>{service.os || "Sem O.S"}</span>
                        <span className="text-xs font-medium text-muted-foreground">{formatPercent(service.andamento)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div>Tag: {service.tag || "—"}</div>
                        <div>Equipamento: {service.equipamento || "—"}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="card bg-background/80 p-4 shadow-inner">
            {selectedService ? (
              <form onSubmit={submitUpdate} className="space-y-4" aria-live="polite">
                <div>
                  <h2 className="text-base font-semibold">Atualizar serviço</h2>
                  <p className="text-xs text-muted-foreground">
                    Informe o progresso atual e descreva (se desejar) o que foi executado nesta etapa.
                  </p>
                </div>

                {selectedService.hasChecklist && selectedService.checklist.length > 0 ? (
                  <div className="space-y-4">
                    {selectedService.checklist.map((item) => (
                      <RangeItem
                        key={item.id}
                        id={`item-${item.id}`}
                        label={`${item.description} (peso ${item.weight}%)`}
                        value={checklistValues[item.id] ?? 0}
                        onChange={(value) => updateChecklistValue(item.id, value)}
                      />
                    ))}
                  </div>
                ) : (
                  <Field
                    label="Percentual total"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={manualPercent}
                    onChange={(event) => setManualPercent(event.target.value)}
                    required
                    hint="Informe o percentual concluído do serviço (0 a 100%)."
                    className="input"
                  />
                )}

                <div className="space-y-1">
                  <label htmlFor="note" className="text-sm font-medium text-foreground/90">
                    Descrição do que foi feito (opcional)
                  </label>
                  <textarea
                    id="note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={4}
                    className="textarea"
                    placeholder="Detalhes relevantes desta atualização"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary h-11 px-5 w-full sm:w-auto"
                  aria-busy={savingUpdate}
                  disabled={savingUpdate}
                >
                  {savingUpdate ? "Enviando..." : "Enviar atualização"}
                </button>
              </form>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
                Valide um token e selecione um serviço para registrar o progresso.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
