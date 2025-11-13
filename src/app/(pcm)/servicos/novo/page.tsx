"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { Field, FormRow } from "@/components/ui/form-controls";
import { createAccessToken } from "@/lib/accessTokens";
import { tryGetFirestore } from "@/lib/firebase";
import { useFirebaseAuthSession } from "@/lib/useFirebaseAuthSession";
import { dateOnlyToMillis, maskDateOnlyInput, parseDateOnly } from "@/lib/dateOnly";

type ChecklistDraft = Array<{ id: string; descricao: string; peso: number | "" }>;

type PackageOption = { id: string; nome: string };

const STATUS_OPTIONS = ["Aberto", "Pendente", "Concluído"] as const;

const newChecklistItem = (): ChecklistDraft[number] => ({
  id:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11),
  descricao: "",
  peso: "",
});

export default function NovoServico() {
  const router = useRouter();
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
  const [withChecklist, setWithChecklist] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistDraft>([]);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const { db: firestore, error: firestoreError } = useMemo(() => tryGetFirestore(), []);
  const { ready: isAuthReady, issue: authIssue } = useFirebaseAuthSession();

  useEffect(() => {
    if (firestoreError) {
      console.error("[servicos/novo] Firestore indisponível", firestoreError);
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
    if (!firestore || !isAuthReady) return;
    setLoadingPackages(true);
    getDocs(query(collection(firestore, "packages"), orderBy("nome", "asc")))
      .then((snapshot) => {
        const result: PackageOption[] = snapshot.docs.map((doc) => {
          const data = doc.data() ?? {};
          return { id: doc.id, nome: String(data.nome ?? data.name ?? "") };
        });
        setPackages(result);
      })
      .catch((error) => {
        console.error("[servicos/novo] Falha ao carregar pacotes", error);
        const errorCode =
          typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string"
            ? ((error as { code: string }).code)
            : null;
        if (errorCode === "permission-denied") {
          toast.error("Você não tem permissão para ver os pacotes disponíveis.");
        } else {
          toast.error("Não foi possível carregar os pacotes disponíveis.");
        }
      })
      .finally(() => setLoadingPackages(false));
  }, [firestore, isAuthReady]);

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
    setChecklist((prev) => [...prev, newChecklistItem()]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sanitizedChecklist = withChecklist
      ? checklist.map((item) => ({
          id: item.id,
          descricao: item.descricao.trim(),
          peso: Math.max(0, Math.min(100, Number(item.peso) || 0)),
        }))
      : [];

    if (withChecklist && sanitizedChecklist.length > 0) {
      if (sanitizedChecklist.some((item) => !item.descricao)) {
        toast.error("Preencha a descrição de todos os itens do checklist.");
        return;
      }
      const total = sanitizedChecklist.reduce((acc, item) => acc + (item.peso || 0), 0);
      if (Math.round(total) !== 100) {
        toast.error("A soma dos pesos do checklist deve ser 100%.");
        return;
      }
    }

    if (!form.os.trim()) {
      toast.error("Informe o número da O.S.");
      return;
    }
    if (!form.tag.trim()) {
      toast.error("Informe a tag do equipamento.");
      return;
    }
    if (!form.equipamento.trim()) {
      toast.error("Informe o equipamento.");
      return;
    }
    const inicioPrevisto = parseDateOnly(form.dataInicio);
    const fimPrevisto = parseDateOnly(form.dataFim);
    if (!inicioPrevisto || !fimPrevisto) {
      toast.error("Datas inválidas. Verifique os valores informados.");
      return;
    }

    const inicioMillis = dateOnlyToMillis(inicioPrevisto);
    const fimMillis = dateOnlyToMillis(fimPrevisto);
    if (inicioMillis > fimMillis) {
      toast.error("A data de término prevista deve ser posterior ou igual à data de início.");
      return;
    }

    const horas = Number(form.horasPrevistas);
    if (!Number.isFinite(horas) || horas <= 0) {
      toast.error("Horas previstas deve ser um número maior que zero.");
      return;
    }

    if (!firestore) {
      toast.error("Banco de dados indisponível.");
      return;
    }
    if (!isAuthReady) {
      toast.error("Sua sessão segura ainda não foi confirmada. Aguarde ou faça login novamente.");
      return;
    }

    setSaving(true);
    try {
      const companyId = form.empresaId.trim() || null;
      const payload = {
        os: form.os.trim(),
        oc: form.oc.trim() || null,
        tag: form.tag.trim(),
        equipamento: form.equipamento.trim(),
        equipmentName: form.equipamento.trim(),
        setor: form.setor.trim() || null,
        inicioPrevisto: Timestamp.fromMillis(inicioMillis),
        fimPrevisto: Timestamp.fromMillis(fimMillis),
        horasPrevistas: horas,
        empresaId: companyId,
        company: companyId,
        status: form.status,
        pacoteId: form.pacoteId || null,
        packageId: form.pacoteId || null,
        andamento: 0,
        checklist: sanitizedChecklist,
        hasChecklist: sanitizedChecklist.length > 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: "pcm",
      };

      const servicesCollection = collection(firestore, "services");
      const docRef = doc(servicesCollection);
      await setDoc(docRef, payload);

      try {
        const token = await createAccessToken({
          serviceId: docRef.id,
          empresa: companyId ?? undefined,
          company: companyId ?? undefined,
        });
        console.info(`[servicos/novo] Token gerado para serviço ${docRef.id}:`, token);
      } catch (tokenError) {
        console.error(`[servicos/novo] Falha ao gerar token do serviço ${docRef.id}`, tokenError);
        try {
          await deleteDoc(docRef);
        } catch (cleanupError) {
          console.error(
            `[servicos/novo] Falha ao remover serviço ${docRef.id} após erro ao gerar token`,
            cleanupError,
          );
        }
        toast.error("Não foi possível criar o serviço. Tente novamente.");
        return;
      }

      if (sanitizedChecklist.length > 0) {
        const batch = writeBatch(firestore);
        const checklistCollection = collection(firestore, "services", docRef.id, "checklist");

        sanitizedChecklist.forEach((item) => {
          const checklistRef = doc(checklistCollection, item.id);
          batch.set(checklistRef, {
            description: item.descricao,
            weight: item.peso,
            progress: 0,
            status: "nao_iniciado",
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      toast.success("Serviço criado com sucesso.");
      router.push("/dashboard");
    } catch (error) {
      console.error("[servicos/novo] Falha ao criar serviço", error);
      toast.error("Não foi possível criar o serviço.");
    } finally {
      setSaving(false);
    }
  }

  if (!isAuthReady) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-2xl border bg-amber-50 p-6 text-sm text-amber-700 shadow-sm">
          {authIssue ?? "Sincronizando sessão segura. Aguarde..."}
        </div>
      </div>
    );
  }

  if (!firestore) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-2xl border bg-card/80 p-6 text-sm text-amber-600 shadow-sm">
          Não foi possível carregar o banco de dados. Verifique a configuração do Firebase.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Novo serviço</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um novo serviço e, se necessário, já defina o checklist de execução.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/dashboard">
          Voltar para o dashboard
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border bg-card/80 p-6 shadow-sm">
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
            placeholder="Identificador da empresa executora"
          />
        </FormRow>
        <FormRow>
          <Field
            label="Data de início prevista"
            value={form.dataInicio}
            onChange={(event) => updateForm("dataInicio", maskDateOnlyInput(event.target.value))}
            onBlur={(event) => updateForm("dataInicio", maskDateOnlyInput(event.target.value))}
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            maxLength={10}
            pattern="\d{2}/\d{2}/\d{4}"
            required
          />
          <Field
            label="Data de término prevista"
            value={form.dataFim}
            onChange={(event) => updateForm("dataFim", maskDateOnlyInput(event.target.value))}
            onBlur={(event) => updateForm("dataFim", maskDateOnlyInput(event.target.value))}
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            maxLength={10}
            pattern="\d{2}/\d{2}/\d{4}"
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
            Pacote (opcional)
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
          {loadingPackages ? <p className="text-xs text-muted-foreground">Carregando pacotes...</p> : null}
        </div>

        <div className="rounded-xl border border-dashed bg-muted/20 p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground/90">
            <input
              type="checkbox"
              checked={withChecklist}
              onChange={(event) => setWithChecklist(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Definir checklist agora?
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
                  Nenhum item adicionado. Clique em &ldquo;Adicionar item&rdquo; para começar.
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
                  <p className="mt-1 text-xs text-amber-600">A soma deve resultar em 100% para o checklist ser válido.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Revise os dados antes de salvar. Você poderá editar o serviço depois.
          </p>
          <button type="submit" className="btn btn-primary" aria-busy={saving} disabled={saving}>
            {saving ? "Salvando..." : "Salvar serviço"}
          </button>
        </div>
      </form>

    </div>
  );
}

