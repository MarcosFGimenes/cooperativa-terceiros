"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { tryGetAuth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatDateTime";

export type FolderSummary = {
  id: string;
  name: string;
  companyId?: string | null;
  services: string[];
  tokenCode?: string | null;
  tokenCreatedAt?: number | null;
};

export type ServiceOption = {
  id: string;
  label: string;
  description?: string;
};

export type ServiceInfo = {
  id: string;
  label: string;
  status: string;
  companyLabel?: string;
  isOpen: boolean;
};

const MAX_VISIBLE_SERVICES = 5;

export type PackageFoldersManagerProps = {
  packageId: string;
  services: ServiceOption[];
  serviceDetails: Record<string, ServiceInfo>;
  initialFolders: FolderSummary[];
};

type FolderState = FolderSummary & {
  services: string[];
};

type ServiceSelectionState = Record<string, Set<string>>;

type PendingMap = Record<string, boolean>;

type BooleanMap = Record<string, boolean>;

function normaliseFolder(folder: FolderSummary): FolderState {
  return {
    ...folder,
    services: Array.isArray(folder.services)
      ? folder.services.map((value) => value.trim()).filter((value) => value.length > 0)
      : [],
  };
}

function formatDate(value?: number | null) {
  if (!value || !Number.isFinite(value)) return "";
  return formatDateTime(value, { timeZone: "America/Sao_Paulo", fallback: "" });
}

async function authorisedFetch(input: string, init?: RequestInit) {
  const { auth, error } = tryGetAuth();
  const user = auth?.currentUser;
  if (!user) {
    throw error ?? new Error("Faça login novamente para continuar.");
  }

  const idToken = await user.getIdToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${idToken}`);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}

function buildAccessLink(token?: string | null) {
  if (!token) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/acesso?token=${token}`;
}

function sortServiceOptions(options: ServiceOption[]) {
  return [...options].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
}

export default function PackageFoldersManager({
  packageId,
  services,
  serviceDetails,
  initialFolders,
}: PackageFoldersManagerProps) {
  const encodedPackageId = useMemo(() => encodeURIComponent(packageId), [packageId]);
  const [folders, setFolders] = useState<FolderState[]>(() =>
    initialFolders.map(normaliseFolder).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
  );
  const [activeFolderId, setActiveFolderId] = useState<string | null>(() => initialFolders[0]?.id ?? null);
  const [serviceSelections, setServiceSelections] = useState<ServiceSelectionState>(() => {
    const initial: ServiceSelectionState = {};
    initialFolders.forEach((folder) => {
      initial[folder.id] = new Set(normaliseFolder(folder).services ?? []);
    });
    return initial;
  });
  const [availableServices, setAvailableServices] = useState<ServiceOption[]>(() => sortServiceOptions(services));
  const [pendingServices, setPendingServices] = useState<PendingMap>({});
  const [savingServices, setSavingServices] = useState<BooleanMap>({});
  const [rotatingToken, setRotatingToken] = useState<BooleanMap>({});
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCompany, setNewFolderCompany] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [savingFolderInfo, setSavingFolderInfo] = useState(false);
  const [addingServicesFor, setAddingServicesFor] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [expandedSelection, setExpandedSelection] = useState<Record<string, boolean>>({});
  const [expandedAssignable, setExpandedAssignable] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!folders.length) {
      setActiveFolderId(null);
      return;
    }
    setActiveFolderId((current) => {
      if (current && folders.some((folder) => folder.id === current)) {
        return current;
      }
      return folders[0]?.id ?? null;
    });
  }, [folders]);

  useEffect(() => {
    setAddingServicesFor((current) => {
      if (!current) return null;
      return folders.some((folder) => folder.id === current) ? current : null;
    });
  }, [folders]);

  function updateServiceSelection(folderId: string, serviceId: string, checked: boolean) {
    setServiceSelections((prev) => {
      const next = { ...prev };
      const current = new Set(next[folderId] ?? []);
      if (checked) {
        current.add(serviceId);
      } else {
        current.delete(serviceId);
      }
      next[folderId] = current;
      return next;
    });
    setPendingServices((prev) => ({ ...prev, [folderId]: true }));
  }

  async function saveFolderServices(folderId: string) {
    const selectedSet = serviceSelections[folderId] ?? new Set<string>();
    const previousSelection = folders.find((folder) => folder.id === folderId)?.services ?? [];
    const selected = Array.from(selectedSet);
    setSavingServices((prev) => ({ ...prev, [folderId]: true }));
    try {
      const encodedFolderId = encodeURIComponent(folderId);
      const response = await authorisedFetch(`/api/pcm/packages/${encodedPackageId}/folders/${encodedFolderId}/services`, {
        method: "PUT",
        body: JSON.stringify({ services: selected }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message =
          typeof data?.error === "string" && data.error ? data.error : "Não foi possível atualizar os serviços.";
        throw new Error(message);
      }
      const updatedFolder = normaliseFolder(data.folder as FolderSummary);
      setFolders((prev) => {
        const next = prev
          .map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
        const added = updatedFolder.services.filter((id) => !previousSelection.includes(id));
        const removed = previousSelection.filter((id) => !updatedFolder.services.includes(id));
        setAvailableServices((current) => {
          const withoutAdded = current.filter((option) => !added.includes(option.id));
          const restored = removed
            .map((id) => serviceDetails[id])
            .filter((info): info is ServiceInfo => Boolean(info) && info.isOpen)
            .map((info) => ({ id: info.id, label: info.label, description: info.companyLabel }));
          const merged = [...withoutAdded];
          restored.forEach((option) => {
            if (!merged.some((existing) => existing.id === option.id)) {
              merged.push(option);
            }
          });
          return sortServiceOptions(merged);
        });
        return next;
      });
      setServiceSelections((prev) => ({ ...prev, [folderId]: new Set(updatedFolder.services) }));
      setPendingServices((prev) => ({ ...prev, [folderId]: false }));
      setAddingServicesFor(null);
      toast.success("Serviços atualizados com sucesso.");
    } catch (error) {
      console.error("[PackageFoldersManager] Falha ao atualizar serviços", error);
      const message = error instanceof Error ? error.message : "Não foi possível atualizar os serviços.";
      toast.error(message);
    } finally {
      setSavingServices((prev) => ({ ...prev, [folderId]: false }));
    }
  }

  async function rotateToken(folderId: string) {
    setRotatingToken((prev) => ({ ...prev, [folderId]: true }));
    try {
      const encodedFolderId = encodeURIComponent(folderId);
      const response = await authorisedFetch(`/api/pcm/packages/${encodedPackageId}/folders/${encodedFolderId}/rotate-token`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message =
          typeof data?.error === "string" && data.error ? data.error : "Não foi possível gerar um novo token.";
        throw new Error(message);
      }
      const updatedFolder = normaliseFolder(data.folder as FolderSummary);
      setFolders((prev) =>
        prev
          .map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
      );
      toast.success("Novo token gerado com sucesso.");
    } catch (error) {
      console.error("[PackageFoldersManager] Falha ao rotacionar token", error);
      const message = error instanceof Error ? error.message : "Não foi possível gerar um novo token.";
      toast.error(message);
    } finally {
      setRotatingToken((prev) => ({ ...prev, [folderId]: false }));
    }
  }

  async function copyTokenLink(folder: FolderState) {
    if (!folder.tokenCode) {
      toast.error("Este subpacote ainda não possui um token ativo.");
      return;
    }
    try {
      const link = buildAccessLink(folder.tokenCode);
      await navigator.clipboard.writeText(link);
      toast.success("Link de acesso copiado para a área de transferência.");
    } catch (error) {
      console.error("[PackageFoldersManager] Falha ao copiar link", error);
      toast.error("Não foi possível copiar o link automaticamente.");
    }
  }

  async function createFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) {
      toast.error("Informe o nome do subpacote.");
      return;
    }
    setCreatingFolder(true);
    try {
      const payload: Record<string, unknown> = { name };
      const companyId = newFolderCompany.trim();
      if (companyId) payload.companyId = companyId;
      const response = await authorisedFetch(`/api/pcm/packages/${encodedPackageId}/folders`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message =
          typeof data?.error === "string" && data.error ? data.error : "Não foi possível criar o subpacote.";
        throw new Error(message);
      }
      const createdFolder = normaliseFolder(data.folder as FolderSummary);
      setFolders((prev) => {
        const next = [...prev, createdFolder].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
        );
        setActiveFolderId(createdFolder.id);
        return next;
      });
      setServiceSelections((prev) => ({ ...prev, [createdFolder.id]: new Set(createdFolder.services) }));
      setNewFolderName("");
      setNewFolderCompany("");
      toast.success("Subpacote criado com sucesso.");
    } catch (error) {
      console.error("[PackageFoldersManager] Falha ao criar subpacote", error);
      const message = error instanceof Error ? error.message : "Não foi possível criar o subpacote.";
      toast.error(message);
    } finally {
      setCreatingFolder(false);
    }
  }

  function startEditing(folder: FolderState) {
    setEditingFolderId(folder.id);
    setEditName(folder.name);
    setEditCompany(folder.companyId ?? "");
  }

  function cancelEditing() {
    setEditingFolderId(null);
    setEditName("");
    setEditCompany("");
    setSavingFolderInfo(false);
  }

  async function saveFolderInfo(folderId: string) {
    const name = editName.trim();
    if (!name) {
      toast.error("O nome do subpacote não pode ficar vazio.");
      return;
    }
    setSavingFolderInfo(true);
    try {
      const encodedFolderId = encodeURIComponent(folderId);
      const response = await authorisedFetch(`/api/pcm/packages/${encodedPackageId}/folders/${encodedFolderId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, companyId: editCompany.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message =
          typeof data?.error === "string" && data.error ? data.error : "Não foi possível atualizar o subpacote.";
        throw new Error(message);
      }
      const updatedFolder = normaliseFolder(data.folder as FolderSummary);
      setFolders((prev) =>
        prev
          .map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
      );
      setEditingFolderId(null);
      toast.success("Dados do subpacote atualizados com sucesso.");
    } catch (error) {
      console.error("[PackageFoldersManager] Falha ao atualizar subpacote", error);
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o subpacote.";
      toast.error(message);
    } finally {
      setSavingFolderInfo(false);
    }
  }

  const activeFolder = useMemo(() => {
    if (!activeFolderId) return null;
    return folders.find((folder) => folder.id === activeFolderId) ?? null;
  }, [activeFolderId, folders]);

  const activeSelection = useMemo(() => {
    if (!activeFolder) return [];
    return Array.from(serviceSelections[activeFolder.id] ?? new Set<string>());
  }, [activeFolder, serviceSelections]);

  const assignableServices = useMemo(() => {
    if (!activeFolder) return [];
    const selection = serviceSelections[activeFolder.id] ?? new Set<string>();
    return availableServices.filter((service) => !selection.has(service.id));
  }, [activeFolder, availableServices, serviceSelections]);

  const filteredAssignable = useMemo(() => {
    if (!serviceSearch.trim()) return assignableServices;
    const query = serviceSearch.trim().toLowerCase();
    return assignableServices.filter((service) =>
      `${service.label} ${service.description ?? ""}`.toLowerCase().includes(query),
    );
  }, [assignableServices, serviceSearch]);

  return (
    <div className="card space-y-6 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Subpacotes</h2>
        <p className="text-sm text-muted-foreground">
          Organize o pacote em subpacotes por empresa, escolha os serviços disponíveis e gere tokens individuais de
          acompanhamento.
        </p>
      </div>

      <form
        onSubmit={createFolder}
        className="grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto]"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome do subpacote</label>
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            className="input"
            placeholder="Ex.: Crystal, Delfor"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa/terceiro</label>
          <input
            value={newFolderCompany}
            onChange={(event) => setNewFolderCompany(event.target.value)}
            className="input"
            placeholder="Identificador da empresa (opcional)"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={creatingFolder}>
            {creatingFolder ? "Criando…" : "Criar subpacote"}
          </button>
        </div>
      </form>

      {folders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nenhum subpacote criado ainda. Crie um subpacote para distribuir o acesso aos terceiros.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lista de subpacotes</p>
            <div className="space-y-2">
              {folders.map((folder) => {
                const isActive = activeFolder?.id === folder.id;
                const selection = serviceSelections[folder.id] ?? new Set<string>();
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      setActiveFolderId(folder.id);
                      setAddingServicesFor(null);
                    }}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring",
                      isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{folder.name}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        {selection.size} serviço{selection.size === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Empresa: {folder.companyId ? folder.companyId : "-"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {activeFolder ? (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{activeFolder.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Empresa vinculada: {activeFolder.companyId ? activeFolder.companyId : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Token atual: <span className="font-mono text-foreground">{activeFolder.tokenCode ?? "Sem token ativo"}</span>
                        {activeFolder.tokenCreatedAt ? (
                          <span className="text-muted-foreground"> • gerado em {formatDate(activeFolder.tokenCreatedAt)}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => copyTokenLink(activeFolder)}
                        disabled={!activeFolder.tokenCode}
                      >
                        Copiar link
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => rotateToken(activeFolder.id)}
                        disabled={rotatingToken[activeFolder.id] ?? false}
                      >
                        {rotatingToken[activeFolder.id] ? "Gerando…" : "Rotacionar token"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost text-xs"
                        onClick={() => startEditing(activeFolder)}
                      >
                        Editar dados
                      </button>
                    </div>
                  </div>

                  {editingFolderId === activeFolder.id ? (
                    <div className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Nome
                        </label>
                        <input value={editName} onChange={(event) => setEditName(event.target.value)} className="input" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Empresa/terceiro
                        </label>
                        <input value={editCompany} onChange={(event) => setEditCompany(event.target.value)} className="input" />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="btn btn-secondary w-full"
                          onClick={cancelEditing}
                          disabled={savingFolderInfo}
                        >
                          Cancelar
                        </button>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="btn btn-primary w-full"
                          onClick={() => saveFolderInfo(activeFolder.id)}
                          disabled={savingFolderInfo}
                        >
                          {savingFolderInfo ? "Salvando…" : "Salvar"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-end gap-3 border-b pb-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setAddingServicesFor((current) => (current === activeFolder.id ? null : activeFolder.id));
                        setServiceSearch("");
                      }}
                    >
                      {addingServicesFor === activeFolder.id ? "Fechar" : "Adicionar serviços"}
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {activeSelection.length === 0 ? (
                      <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                        Selecione serviços disponíveis para este subpacote.
                      </div>
                    ) : (
                      <>
                        {(expandedSelection[activeFolder.id] ?? false
                          ? activeSelection
                          : activeSelection.slice(0, MAX_VISIBLE_SERVICES)
                        ).map((serviceId) => {
                          const info = serviceDetails[serviceId];
                          const label = info?.label ?? serviceId;
                          const company = info?.companyLabel ? ` • ${info.companyLabel}` : "";
                          return (
                            <div
                              key={serviceId}
                              className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">{label}</p>
                                <p className="text-xs text-muted-foreground">
                                  ID: {serviceId}
                                  {company}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost text-xs text-destructive"
                                onClick={() => updateServiceSelection(activeFolder.id, serviceId, false)}
                              >
                                Remover
                              </button>
                            </div>
                          );
                        })}
                        {activeSelection.length > MAX_VISIBLE_SERVICES ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <span>
                              Mostrando
                              {expandedSelection[activeFolder.id]
                                ? ` ${activeSelection.length}`
                                : ` ${Math.min(activeSelection.length, MAX_VISIBLE_SERVICES)}`}
                              {` de ${activeSelection.length} serviço${activeSelection.length === 1 ? "" : "s"}.`}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost text-xs"
                              onClick={() =>
                                setExpandedSelection((prev) => ({
                                  ...prev,
                                  [activeFolder.id]: !(prev[activeFolder.id] ?? false),
                                }))
                              }
                            >
                              {expandedSelection[activeFolder.id] ? "Mostrar menos" : "Mostrar mais"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <div className="text-xs text-muted-foreground">
                      {pendingServices[activeFolder.id]
                        ? "Existem alterações pendentes. Salve para aplicar."
                        : "Nenhuma alteração pendente."}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => saveFolderServices(activeFolder.id)}
                      disabled={savingServices[activeFolder.id] || !(pendingServices[activeFolder.id] ?? false)}
                    >
                      {savingServices[activeFolder.id] ? "Salvando…" : "Salvar alterações"}
                    </button>
                  </div>

                  {addingServicesFor === activeFolder.id ? (
                    <div className="mt-4 space-y-3 rounded-lg border border-dashed p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h5 className="text-sm font-semibold">Serviços disponíveis</h5>
                          <p className="text-xs text-muted-foreground">
                            Apenas serviços abertos ou pendentes disponíveis para este pacote e sem vínculo com outros
                            subpacotes aparecem nesta lista.
                          </p>
                        </div>
                        <input
                          value={serviceSearch}
                          onChange={(event) => setServiceSearch(event.target.value)}
                          className="input"
                          placeholder="Buscar por OS, código ou empresa"
                        />
                      </div>
                      {filteredAssignable.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum serviço aberto disponível com os filtros atuais.
                        </p>
                      ) : (
                        <>
                          <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                            {(expandedAssignable[activeFolder.id] ?? false
                              ? filteredAssignable
                              : filteredAssignable.slice(0, MAX_VISIBLE_SERVICES)
                            ).map((service) => (
                              <label
                                key={service.id}
                                className="flex cursor-pointer items-start gap-2 rounded border p-3 text-sm hover:border-primary/40 hover:bg-muted/40"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={serviceSelections[activeFolder.id]?.has(service.id) ?? false}
                                  onChange={(event) => updateServiceSelection(activeFolder.id, service.id, event.target.checked)}
                                />
                                <span>
                                  <span className="font-medium text-foreground">{service.label}</span>
                                  {service.description ? (
                                    <span className="block text-xs text-muted-foreground">{service.description}</span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                          {filteredAssignable.length > MAX_VISIBLE_SERVICES ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>
                                Mostrando
                                {expandedAssignable[activeFolder.id]
                                  ? ` ${filteredAssignable.length}`
                                  : ` ${Math.min(filteredAssignable.length, MAX_VISIBLE_SERVICES)}`}
                                {` de ${filteredAssignable.length} serviço${filteredAssignable.length === 1 ? "" : "s"} disponíveis.`}
                              </span>
                              <button
                                type="button"
                                className="btn btn-ghost text-xs"
                                onClick={() =>
                                  setExpandedAssignable((prev) => ({
                                    ...prev,
                                    [activeFolder.id]: !(prev[activeFolder.id] ?? false),
                                  }))
                                }
                              >
                                {expandedAssignable[activeFolder.id] ? "Mostrar menos" : "Mostrar mais"}
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Selecione um subpacote para visualizar os detalhes e gerenciar os serviços vinculados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
