"use client";

import { useState } from "react";
import { toast } from "sonner";

import { tryGetAuth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

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
};

type Props = {
  packageId: string;
  services: ServiceOption[];
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
    services: Array.isArray(folder.services) ? folder.services.map((value) => value.trim()) : [],
  };
}

function formatDate(value?: number | null) {
  if (!value || !Number.isFinite(value)) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
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

export default function PackageFoldersManager({ packageId, services, initialFolders }: Props) {
  const [folders, setFolders] = useState<FolderState[]>(() =>
    initialFolders.map(normaliseFolder).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
  );
  const [serviceSelections, setServiceSelections] = useState<ServiceSelectionState>(() => {
    const initial: ServiceSelectionState = {};
    initialFolders.forEach((folder) => {
      initial[folder.id] = new Set(folder.services ?? []);
    });
    return initial;
  });
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
    const selected = Array.from(serviceSelections[folderId] ?? []);
    setSavingServices((prev) => ({ ...prev, [folderId]: true }));
    try {
      const response = await authorisedFetch(
        `/api/pcm/packages/${packageId}/folders/${folderId}/services`,
        {
          method: "PUT",
          body: JSON.stringify({ services: selected }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message = typeof data?.error === "string" && data.error ? data.error : "Não foi possível atualizar os serviços.";
        throw new Error(message);
      }
      const updatedFolder = normaliseFolder(data.folder as FolderSummary);
      setFolders((prev) =>
        prev
          .map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
      );
      setServiceSelections((prev) => ({ ...prev, [folderId]: new Set(updatedFolder.services) }));
      setPendingServices((prev) => ({ ...prev, [folderId]: false }));
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
      const response = await authorisedFetch(
        `/api/pcm/packages/${packageId}/folders/${folderId}/rotate-token`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message = typeof data?.error === "string" && data.error ? data.error : "Não foi possível gerar um novo token.";
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
      toast.error("Esta pasta ainda não possui um token ativo.");
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
      toast.error("Informe o nome da pasta.");
      return;
    }
    setCreatingFolder(true);
    try {
      const payload: Record<string, unknown> = { name };
      const companyId = newFolderCompany.trim();
      if (companyId) payload.companyId = companyId;
      const response = await authorisedFetch(`/api/pcm/packages/${packageId}/folders`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message = typeof data?.error === "string" && data.error ? data.error : "Não foi possível criar a pasta.";
        throw new Error(message);
      }
      const createdFolder = normaliseFolder(data.folder as FolderSummary);
      setFolders((prev) =>
        [...prev, createdFolder].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
      );
      setServiceSelections((prev) => ({ ...prev, [createdFolder.id]: new Set(createdFolder.services) }));
      setNewFolderName("");
      setNewFolderCompany("");
      toast.success("Pasta criada com sucesso.");
    } catch (error) {
      console.error("[PackageFoldersManager] Falha ao criar pasta", error);
      const message = error instanceof Error ? error.message : "Não foi possível criar a pasta.";
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
      toast.error("O nome da pasta não pode ficar vazio.");
      return;
    }
    setSavingFolderInfo(true);
    try {
      const response = await authorisedFetch(`/api/pcm/packages/${packageId}/folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, companyId: editCompany.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const message = typeof data?.error === "string" && data.error ? data.error : "Não foi possível atualizar a pasta.";
        throw new Error(message);
      }
      const updatedFolder = normaliseFolder(data.folder as FolderSummary);
      setFolders((prev) =>
        prev
          .map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
      );
      setEditingFolderId(null);
      toast.success("Dados da pasta atualizados com sucesso.");
    } catch (error) {
      console.error("[PackageFoldersManager] Falha ao atualizar pasta", error);
      const message = error instanceof Error ? error.message : "Não foi possível atualizar a pasta.";
      toast.error(message);
    } finally {
      setSavingFolderInfo(false);
    }
  }

  return (
    <div className="card space-y-6 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Pastas de acesso</h2>
        <p className="text-sm text-muted-foreground">
          Crie pastas por empresa para organizar os serviços e gerar tokens individuais de acompanhamento.
        </p>
      </div>

      <form onSubmit={createFolder} className="grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-[2fr_1.2fr_auto]">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome da pasta</label>
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
            {creatingFolder ? "Criando…" : "Criar pasta"}
          </button>
        </div>
      </form>

      {folders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nenhuma pasta criada ainda. Crie uma pasta para distribuir o acesso aos terceiros.
        </div>
      ) : (
        <div className="space-y-4">
          {folders.map((folder) => {
            const selection = serviceSelections[folder.id] ?? new Set<string>();
            const isSavingServices = savingServices[folder.id] ?? false;
            const hasPendingServices = pendingServices[folder.id] ?? false;
            const isRotating = rotatingToken[folder.id] ?? false;
            const isEditing = editingFolderId === folder.id;
            const tokenLabel = folder.tokenCode ? folder.tokenCode : "Sem token ativo";
            const tokenDate = formatDate(folder.tokenCreatedAt);

            return (
              <div key={folder.id} className="rounded-lg border p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{folder.name}</h3>
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        {folder.services.length} serviço{folder.services.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Empresa vinculada: {folder.companyId ? folder.companyId : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Token atual: <span className="font-mono text-foreground">{tokenLabel}</span>
                      {tokenDate ? <span className="text-muted-foreground"> • gerado em {tokenDate}</span> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => copyTokenLink(folder)}
                      disabled={!folder.tokenCode}
                    >
                      Copiar link
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => rotateToken(folder.id)}
                      disabled={isRotating}
                    >
                      {isRotating ? "Gerando…" : "Rotacionar token"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => startEditing(folder)}
                    >
                      Editar dados
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[2fr_1fr_auto_auto]">
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
                        onClick={() => saveFolderInfo(folder.id)}
                        disabled={savingFolderInfo}
                      >
                        {savingFolderInfo ? "Salvando…" : "Salvar"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Serviços nesta pasta
                  </p>
                  {services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum serviço disponível para vincular.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {services.map((service) => {
                        const checked = selection.has(service.id);
                        return (
                          <label
                            key={service.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
                              checked ? "border-primary/50 bg-primary/5" : "border-border",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={(event) => updateServiceSelection(folder.id, service.id, event.target.checked)}
                            />
                            <span>{service.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => saveFolderServices(folder.id)}
                      disabled={isSavingServices || !hasPendingServices}
                    >
                      {isSavingServices ? "Salvando…" : "Salvar serviços"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
