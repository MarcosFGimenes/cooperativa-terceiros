"use client";

import { useMemo, useState } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const HEADERS = [
  "item",
  "md",
  "os",
  "setor",
  "tagMaquina",
  "equipNovo",
  "equipAntigo",
  "descricaoServicos",
  "prioridade",
  "dataInicio",
  "dataFinal",
  "quantasPessoas",
  "tempoEstimado",
  "totalHoraHomem",
  "empresa",
  "frentesEquipe",
  "horasExecutadas",
  "custoPlanejadoPecas",
  "valorBaixado",
  "valorEstornado",
  "custoRealizadoPecas",
] as const;

type HeaderKey = (typeof HEADERS)[number];

const COLUMN_LABELS: Record<HeaderKey, string> = {
  item: "ITEM",
  md: "MD",
  os: "O.S",
  setor: "SETOR",
  tagMaquina: "TAG MAQUINA",
  equipNovo: "EQUIP. NOVO",
  equipAntigo: "EQUIP. ANTIGO",
  descricaoServicos: "DESCRIÇÃO SERVIÇOS",
  prioridade: "PRIORIDADE",
  dataInicio: "DATA DE INICIO",
  dataFinal: "DATA FINAL",
  quantasPessoas: "QUANTAS PESSOAS",
  tempoEstimado: "TEMPO ESTIMADO PARA EXECUÇÃO SERVIÇOS",
  totalHoraHomem: "TOTAL DE HORA HOMEM",
  empresa: "EMPRESA",
  frentesEquipe: "FRENTES DE EQUIPE",
  horasExecutadas: "HORAS EXECUTADAS",
  custoPlanejadoPecas: "CUSTO PLANEJADO DE PEÇAS",
  valorBaixado: "VALOR BAIXADO",
  valorEstornado: "VALOR ESTORNADO",
  custoRealizadoPecas: "CUSTO REALIZADO DE PEÇAS (BAIXADO - ESTORNO)",
};

type RawRow = Partial<Record<HeaderKey, unknown>>;

type ParsedRow = {
  id: string;
  raw: RawRow;
  cleaned: Record<HeaderKey, string | number | null>;
};

type ServiceImportResult = {
  status: "pending" | "success" | "error";
  message?: string;
  serviceId?: string;
};

function normaliseString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ".").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function excelDateToDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF?.parse_date_code?.(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  if (typeof value === "string") {
    const possible = new Date(value);
    return Number.isNaN(possible.getTime()) ? null : possible;
  }

  return null;
}

function parseSheet(buffer: ArrayBuffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];

  const rows = XLSX.utils.sheet_to_json<RawRow>(firstSheet, {
    header: HEADERS as string[],
    range: 8, // pula as 8 primeiras linhas (dados começam na linha 9)
    defval: null,
    blankrows: false,
  });

  return rows
    .map((raw, index) => {
      const cleaned = HEADERS.reduce((acc, key) => {
        const value = raw[key];
        const str = normaliseString(value);
        const num = toNumber(value);
        const date = excelDateToDate(value);

        if (date) {
          acc[key] = date.toISOString();
        } else if (num !== null && str === "") {
          acc[key] = num;
        } else {
          acc[key] = str || null;
        }

        return acc;
      }, {} as Record<HeaderKey, string | number | null>);

      return {
        id: `${index}-${Math.random().toString(36).slice(2, 7)}`,
        raw,
        cleaned,
      };
    })
    .filter((row) => normaliseString(row.cleaned.item) || normaliseString(row.cleaned.descricaoServicos));
}

function buildServicePayload(
  row: ParsedRow["cleaned"],
  options: { defaultCompanyId: string; folderId: string; useExcelCompany: boolean },
) {
  const descricao = normaliseString(row.descricaoServicos);
  const os = normaliseString(row.os) || normaliseString(row.item);
  const tag = normaliseString(row.tagMaquina) || `ITEM-${os || "sem-tag"}`;
  const equipamento = normaliseString(row.equipNovo) || normaliseString(row.equipAntigo) || descricao || tag;
  const setor = normaliseString(row.setor);

  const inicio = excelDateToDate(row.dataInicio);
  const fim = excelDateToDate(row.dataFinal);

  const horasPrevistas =
    toNumber(row.totalHoraHomem) ?? toNumber(row.tempoEstimado) ?? (toNumber(row.quantasPessoas) || 0);

  const resolvedCompanyId = options.useExcelCompany
    ? normaliseString(row.empresa) || options.defaultCompanyId
    : options.defaultCompanyId;

  return {
    valid:
      !!descricao &&
      !!os &&
      !!tag &&
      !!equipamento &&
      inicio instanceof Date &&
      fim instanceof Date &&
      typeof horasPrevistas === "number" &&
      Number.isFinite(horasPrevistas) &&
      horasPrevistas > 0,
    payload: {
      os,
      oc: normaliseString(row.md) || null,
      tag,
      equipamento,
      equipmentName: equipamento,
      setor: setor || null,
      inicioPrevistoMillis: inicio?.getTime() ?? NaN,
      fimPrevistoMillis: fim?.getTime() ?? NaN,
      horasPrevistas: horasPrevistas ?? NaN,
      empresaId: resolvedCompanyId || null,
      companyId: resolvedCompanyId || null,
      folderId: options.folderId || null,
      status: "Aberto",
      checklist: [],
      label: descricao,
      participantsCount: toNumber(row.quantasPessoas) ?? null,
      estimatedTime: toNumber(row.tempoEstimado) ?? null,
      metadata: {
        prioridade: normaliseString(row.prioridade) || null,
        frentesEquipe: normaliseString(row.frentesEquipe) || null,
        horasExecutadas: toNumber(row.horasExecutadas),
        custos: {
          planejadoPecas: toNumber(row.custoPlanejadoPecas),
          valorBaixado: toNumber(row.valorBaixado),
          valorEstornado: toNumber(row.valorEstornado),
          realizadoPecas: toNumber(row.custoRealizadoPecas),
        },
        origemExcel: true,
      },
    },
  };
}

export default function ExcelImport() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, ServiceImportResult>>({});
  const [defaultCompanyId, setDefaultCompanyId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [useExcelCompany, setUseExcelCompany] = useState(true);

  const validRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        prepared: buildServicePayload(row.cleaned, { defaultCompanyId, folderId, useExcelCompany }),
      })),
    [rows, defaultCompanyId, folderId, useExcelCompany],
  );

  async function handleFile(file: File) {
    setLoading(true);
    setResults({});
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSheet(buffer);
      if (!parsed.length) {
        toast.warning("Nenhuma linha válida encontrada na planilha.");
      }
      setRows(parsed);
    } catch (error) {
      console.error("[ExcelImport] Falha ao ler planilha", error);
      toast.error("Não foi possível ler o arquivo. Verifique se o formato está correto.");
    } finally {
      setLoading(false);
    }
  }

  async function sendAll() {
    setLoading(true);
    const nextResults: Record<string, ServiceImportResult> = {};

    for (const row of validRows) {
      const { payload, valid } = row.prepared;

      if (!valid) {
        nextResults[row.id] = { status: "error", message: "Dados obrigatórios ausentes ou inválidos." };
        continue;
      }

      nextResults[row.id] = { status: "pending" };
      setResults({ ...nextResults });

      try {
        const response = await fetch("/api/pcm/servicos/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as { ok?: boolean; serviceId?: string; error?: string } | null;

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Falha ao criar serviço.");
        }

        nextResults[row.id] = { status: "success", serviceId: data.serviceId };
      } catch (error) {
        console.error("[ExcelImport] Falha ao criar serviço", error);
        nextResults[row.id] = {
          status: "error",
          message: error instanceof Error ? error.message : "Não foi possível criar o serviço.",
        };
      }
    }

    setResults(nextResults);
    setLoading(false);

    const successCount = Object.values(nextResults).filter((r) => r.status === "success").length;
    if (successCount) {
      toast.success(`${successCount} serviço(s) criado(s) com sucesso.`);
    }

    const errorCount = Object.values(nextResults).filter((r) => r.status === "error").length;
    if (errorCount) {
      toast.error(`${errorCount} linha(s) não puderam ser importadas. Revise e tente novamente.`);
    }
  }

  return (
    <div className="rounded-2xl border bg-card/80 p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Importar serviços via Excel</h2>
          <p className="text-sm text-muted-foreground">
            Use a planilha padrão (linha 8 como cabeçalho) para criar serviços em massa.
          </p>
        </div>
        <label className="btn btn-outline inline-flex cursor-pointer items-center gap-2" htmlFor="excel-upload">
          <UploadCloud className="h-4 w-4" />
          {loading ? "Processando..." : "Selecionar planilha"}
          <input
            id="excel-upload"
            type="file"
            accept=".xlsx,.xlsm"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }}
            disabled={loading}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa padrão</label>
          <input
            className="input"
            value={defaultCompanyId}
            onChange={(event) => setDefaultCompanyId(event.target.value)}
            placeholder="Ex: EMP-01"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border"
              checked={useExcelCompany}
              onChange={(event) => setUseExcelCompany(event.target.checked)}
            />
            Usar coluna EMPRESA quando disponível
          </label>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subpacote (folderId)</label>
          <input
            className="input"
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <button
            className="btn btn-primary"
            onClick={sendAll}
            disabled={loading || validRows.length === 0}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar serviços ({validRows.length})
          </button>
          <p className="text-xs text-muted-foreground">
            Revise a lista abaixo. Linhas sem ITEM ou DESCRIÇÃO SERVIÇOS são ignoradas automaticamente.
          </p>
        </div>
      </div>

      {validRows.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border bg-background/50">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">O.S</th>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Fim</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {validRows.map((row) => {
                const result = results[row.id];
                const descricao = normaliseString(row.cleaned.descricaoServicos) || "(sem descrição)";
                const inicio = excelDateToDate(row.cleaned.dataInicio)?.toLocaleDateString("pt-BR") ?? "-";
                const fim = excelDateToDate(row.cleaned.dataFinal)?.toLocaleDateString("pt-BR") ?? "-";
                const empresa = row.prepared.payload.empresaId || "-";

                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{descricao}</td>
                    <td className="px-4 py-3">{normaliseString(row.cleaned.os) || "-"}</td>
                    <td className="px-4 py-3">{normaliseString(row.cleaned.tagMaquina) || "-"}</td>
                    <td className="px-4 py-3">{inicio}</td>
                    <td className="px-4 py-3">{fim}</td>
                    <td className="px-4 py-3">{empresa}</td>
                    <td className="px-4 py-3">
                      {result?.status === "success" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Importado</span>
                      )}
                      {result?.status === "error" && (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                          {result.message || "Erro"}
                        </span>
                      )}
                      {!result && (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Aguardando</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="btn btn-ghost btn-xs text-destructive"
                        onClick={() => setRows((prev) => prev.filter((entry) => entry.id !== row.id))}
                        title="Remover linha"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Importe o arquivo “PLANILHA.xlsm” ou “.xlsx” para visualizar os registros aqui.
        </div>
      )}

      <details className="mt-4 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-foreground">
          Colunas esperadas
        </summary>
        <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {HEADERS.map((key) => (
            <div key={key} className="rounded-lg bg-background/80 p-3 shadow-inner">
              <p className="text-xs font-semibold text-foreground">{COLUMN_LABELS[key]}</p>
              <p className="text-xs text-muted-foreground">Chave: {key}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
