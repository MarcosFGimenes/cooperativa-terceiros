import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { ensureServiceAccessToken } from "@/lib/repo/accessTokens";
import {
  buildServiceImportKey,
  createService,
  findServicesByImportKeys,
  findServicesByOsList,
} from "@/lib/repo/services";
import { excelDateNumberToMillis, parseXlsxTable } from "@/lib/xlsxParser";

export const runtime = "nodejs";

const HEADER_ALIASES: Record<string, string[]> = {
  os: ["O.S", "OS", "ORDEM DE SERVICO", "ORDEM DE SERVIÇO"],
  setor: ["SETOR", "SETOR "],
  tag: ["TAG MAQUINA", "TAG MÁQUINA", "TAG", "TAG MAQ"],
  equipamento: ["EQUIP. NOVO", "EQUIPAMENTO NOVO", "EQUIPAMENTO"],
  descricao: ["DESCRIÇÃO SERVIÇOS", "DESCRICAO SERVICOS", "DESCRIÇÃO SERVIÇO", "DESCRICAO SERVICO"],
  dataInicio: ["DATA DE INICIO", "DATA DE INÍCIO", "DATA INICIO", "INICIO"],
  dataFim: ["DATA FINAL", "DATA FIM", "FIM"],
  empresa: ["EMPRESA"],
  horas: ["TOTAL DE HORA HOMEM", "TOTAL HORA HOMEM", "TOTAL DE HORA-HOMEM"],
};

function normaliseHeaderKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function pickField(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  const normalisedMap = new Map<string, string>(
    keys.map((key) => [normaliseHeaderKey(key), key]),
  );

  for (const alias of aliases) {
    const match = normalisedMap.get(normaliseHeaderKey(alias));
    if (match) return row[match];
  }
  return undefined;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value ?? "");
}

function parseDateValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel stores dates as serial numbers.
    return excelDateNumberToMillis(value);
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const [day, month, year] = trimmed.split(/[\/\-]/).map((part) => Number(part));
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      const resolvedYear = year < 100 ? 2000 + year : year;
      const date = Date.UTC(resolvedYear, (month || 1) - 1, day || 1);
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseHours(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9,\.\-]+/g, "").replace(",", ".");
    const numeric = Number(cleaned);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

type ParsedRow = {
  os: string;
  setor: string | null;
  tag: string;
  equipamento: string;
  descricao: string;
  inicio: number;
  fim: number;
  empresa: string | null;
  horas: number;
  importKey: string;
};

async function sanitiseRow(row: Record<string, unknown>): Promise<ParsedRow | { error: string }> {
  const os = toText(pickField(row, HEADER_ALIASES.os)).trim();
  const tag = toText(pickField(row, HEADER_ALIASES.tag)).trim();
  const equipamento = toText(pickField(row, HEADER_ALIASES.equipamento)).trim();
  const descricao = toText(pickField(row, HEADER_ALIASES.descricao)).trim();
  const setor = toText(pickField(row, HEADER_ALIASES.setor)).trim() || null;
  const empresa = toText(pickField(row, HEADER_ALIASES.empresa)).trim() || null;
  const horas = parseHours(pickField(row, HEADER_ALIASES.horas));
  const inicio = parseDateValue(pickField(row, HEADER_ALIASES.dataInicio));
  const fim = parseDateValue(pickField(row, HEADER_ALIASES.dataFim));

  if (!os || !tag || !equipamento) {
    return { error: "Linha ignorada: dados essenciais ausentes (O.S., TAG ou Equipamento)." };
  }
  if (!inicio || !fim) {
    return { error: "Linha ignorada: datas de início ou fim inválidas." };
  }
  if (inicio > fim) {
    return { error: "Linha ignorada: data final anterior à data inicial." };
  }
  if (horas === null || horas <= 0) {
    return { error: "Linha ignorada: total de horas inválido." };
  }

  const importKey = await buildServiceImportKey({
    os,
    setor,
    tag,
    equipmentName: equipamento,
    plannedStart: inicio,
    plannedEnd: fim,
    empresa,
  });

  if (!importKey) {
    return { error: "Linha ignorada: não foi possível gerar uma chave de importação." };
  }

  return {
    os,
    setor,
    tag,
    equipamento,
    descricao,
    inicio,
    fim,
    empresa,
    horas,
    importKey,
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Envie o arquivo da planilha." }, { status: 400 });
  }

  let rows: Record<string, unknown>[] = [];
  try {
    const buffer = await file.arrayBuffer();
    rows = parseXlsxTable(buffer, 8);
  } catch (error) {
    console.error("[services/import] Falha ao ler XLSX", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Não foi possível ler a planilha. Confirme se é um arquivo XLSX válido.",
      },
      { status: 400 },
    );
  }

  let skipped = 0;
  let duplicateKeys = 0;
  const seenKeys = new Set<string>();
  const parsedRows: ParsedRow[] = [];

  for (const row of rows) {
    const parsed = await sanitiseRow(row);
    if ("error" in parsed) {
      skipped += 1;
      continue;
    }
    if (seenKeys.has(parsed.importKey)) {
      duplicateKeys += 1;
      continue;
    }
    seenKeys.add(parsed.importKey);
    parsedRows.push(parsed);
  }

  if (!parsedRows.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "Nenhum serviço válido encontrado na planilha.",
      },
      { status: 400 },
    );
  }

  const existingByKey = await findServicesByImportKeys(parsedRows.map((item) => item.importKey));
  const existingKeySet = new Set(
    existingByKey.map((service) => service.importKey).filter((key): key is string => Boolean(key)),
  );

  const existingByOs = await findServicesByOsList(parsedRows.map((item) => item.os));
  for (const service of existingByOs) {
    const computedKey =
      service.importKey ||
      (await buildServiceImportKey({
        os: service.os,
        tag: service.tag,
        setor: service.setor ?? service.sector ?? null,
        equipmentName: service.equipmentName,
        plannedStart: service.plannedStart,
        plannedEnd: service.plannedEnd,
        empresa: service.company ?? service.empresa ?? null,
      }));
    if (computedKey) {
      existingKeySet.add(computedKey);
    }
  }

  const toCreate = parsedRows.filter((row) => !existingKeySet.has(row.importKey));
  const duplicatesFromDatabase = parsedRows.length - toCreate.length;

  const createdServices: Array<{ id: string; empresa: string | null }> = [];

  try {
    for (const row of toCreate) {
      const { id } = await createService({
        os: row.os,
        oc: null,
        tag: row.tag,
        equipamento: row.equipamento,
        equipmentName: row.equipamento,
        setor: row.setor,
        inicioPrevistoMillis: row.inicio,
        fimPrevistoMillis: row.fim,
        horasPrevistas: row.horas,
        empresaId: row.empresa,
        status: "Aberto",
        checklist: [],
        description: row.descricao,
        importKey: row.importKey,
      });
      createdServices.push({ id, empresa: row.empresa });
    }
  } catch (error) {
    console.error("[services/import] Falha ao criar serviços", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Não foi possível criar todos os serviços. Nenhum dado duplicado foi inserido.",
      },
      { status: 500 },
    );
  }

  await Promise.all(
    createdServices.map(async (service) => {
      try {
        await ensureServiceAccessToken({ serviceId: service.id, company: service.empresa ?? undefined });
      } catch (tokenError) {
        console.error("[services/import] Falha ao gerar token para serviço importado", tokenError);
      }
    }),
  );

  if (createdServices.length > 0) {
    revalidateTag("services:available");
  }

  return NextResponse.json({
    ok: true,
    created: createdServices.length,
    duplicates: duplicateKeys + duplicatesFromDatabase,
    skipped,
  });
}
