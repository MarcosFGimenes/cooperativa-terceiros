export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function snapshotBeforeConclusion(current: number, previous?: number | null): number {
  const candidates = [current, previous].filter((value): value is number => Number.isFinite(value ?? NaN));
  for (const candidate of candidates) {
    const clamped = clampProgress(candidate);
    if (clamped < 100) {
      return clamped;
    }
  }
  return 0;
}

type ResolveReopenParams = {
  requested?: number | null;
  previousStored?: number | null;
  history?: Array<number | null | undefined>;
  current?: number | null;
};

export function resolveReopenedProgress({
  requested,
  previousStored,
  history = [],
  current,
}: ResolveReopenParams): number {
  const candidates: Array<number | null | undefined> = [requested, previousStored, ...history, current];

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate ?? NaN)) continue;
    const clamped = clampProgress(Number(candidate));
    if (clamped < 100) {
      return clamped;
    }
  }

  return 0;
}

type DateInput =
  | string
  | number
  | Date
  | { toDate?: () => Date; toMillis?: () => number }
  | null
  | undefined;

export type ServicoDoSubpacote = {
  id?: string;
  nome?: string;
  horasPrevistas?: number | string | null;
  totalHours?: number | string | null;
  horas?: number | string | null;
  hours?: number | string | null;
  peso?: number | string | null;
  weight?: number | string | null;
  dataInicio?: DateInput;
  inicioPrevisto?: DateInput;
  inicioPlanejado?: DateInput;
  plannedStart?: DateInput;
  startDate?: DateInput;
  dataFim?: DateInput;
  fimPrevisto?: DateInput;
  fimPlanejado?: DateInput;
  plannedEnd?: DateInput;
  endDate?: DateInput;
  [key: string]: unknown;
};

export type SubpacotePlanejado = {
  id?: string;
  nome?: string;
  servicos?: ServicoDoSubpacote[] | null;
  services?: ServicoDoSubpacote[] | null;
  [key: string]: unknown;
};

export type ServicoPlanejado = {
  id?: string | number | null;
  descricao?: string | null;
  description?: string | null;
  dataInicio?: DateInput;
  dataFim?: DateInput;
  inicio?: DateInput;
  fim?: DateInput;
  percentualRealAtual?: number | string | null;
  percentualReal?: number | string | null;
  percentualInformado?: number | string | null;
  progressoReal?: number | string | null;
  realProgress?: number | string | null;
  currentProgress?: number | string | null;
  [key: string]: unknown;
};

export type ServicoPlanejadoResumo = {
  id?: string;
  descricao?: string;
  percentualPlanejado: number;
  percentualReal: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function toDate(value: DateInput): Date | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : new Date(time);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object") {
    const source = value as { toDate?: () => Date; toMillis?: () => number };
    if (typeof source.toDate === "function") {
      const date = source.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return new Date(date.getTime());
      }
    }
    if (typeof source.toMillis === "function") {
      const millis = source.toMillis();
      if (typeof millis === "number" && Number.isFinite(millis)) {
        const date = new Date(millis);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }
  return null;
}

function getDateFromKeys(service: ServicoDoSubpacote, keys: string[]): Date | null {
  for (const key of keys) {
    if (Object.hasOwn(service, key)) {
      const value = toDate(service[key] as DateInput);
      if (value) return value;
    }
  }
  return null;
}

function daysBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff)) return 0;
  return Math.max(0, diff / DAY_IN_MS);
}

type ServiceProgressEntry = { horasPrevistas: number; percentual: number };

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function parsePercentual(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampPercentage(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return clampPercentage(parsed);
    }
  }
  return null;
}

function normalizeDescricao(servico: ServicoPlanejado | ServicoDoSubpacote | null | undefined): string | undefined {
  if (!servico) return undefined;
  const candidatos = [servico.descricao, (servico as { description?: unknown }).description];
  for (const valor of candidatos) {
    if (typeof valor === "string") {
      const trimmed = valor.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return undefined;
}

function mapServicoParaPercentual(
  servico: ServicoDoSubpacote,
  referencia: Date,
): ServiceProgressEntry | null {
  const horasPrevistas =
    toPositiveNumber(servico.horasPrevistas) ??
    toPositiveNumber(servico.totalHours) ??
    toPositiveNumber(servico.horas) ??
    toPositiveNumber(servico.hours) ??
    toPositiveNumber(servico.peso) ??
    toPositiveNumber(servico.weight);
  if (!horasPrevistas) return null;

  const inicio =
    getDateFromKeys(servico, ["dataInicio", "inicioPrevisto", "inicioPlanejado", "plannedStart", "startDate", "inicio"])
    ?? null;
  const fim =
    getDateFromKeys(servico, ["dataFim", "fimPrevisto", "fimPlanejado", "plannedEnd", "endDate", "fim"])
    ?? null;
  if (!inicio || !fim) return null;
  if (fim.getTime() <= inicio.getTime()) return null;

  const totalDias = Math.max(1, daysBetween(inicio, fim));
  const referenciaMs = referencia.getTime();
  const inicioMs = inicio.getTime();
  const fimMs = fim.getTime();

  let diasDecorridos = 0;
  if (referenciaMs <= inicioMs) {
    diasDecorridos = 0;
  } else if (referenciaMs >= fimMs) {
    diasDecorridos = totalDias;
  } else {
    diasDecorridos = daysBetween(inicio, referencia);
  }

  const percentual = Math.max(0, Math.min(100, (diasDecorridos / totalDias) * 100));
  return { horasPrevistas, percentual };
}

export function calcularPercentualSubpacote(
  subpacote: SubpacotePlanejado | null | undefined,
  dataReferencia?: DateInput,
): number {
  const referencia = toDate(dataReferencia ?? new Date()) ?? new Date();
  const listaServicosRaw =
    (Array.isArray(subpacote?.servicos) && subpacote?.servicos) ||
    (Array.isArray(subpacote?.services) && subpacote?.services) ||
    [];

  const servicosValidos = listaServicosRaw
    .map((servico) => mapServicoParaPercentual(servico, referencia))
    .filter((entry): entry is ServiceProgressEntry => Boolean(entry));

  const somaHoras = servicosValidos.reduce((total, entry) => total + entry.horasPrevistas, 0);
  if (somaHoras <= 0) return 0;

  const somaPonderada = servicosValidos.reduce(
    (total, entry) => total + entry.percentual * entry.horasPrevistas,
    0,
  );
  const percentual = somaPonderada / somaHoras;
  if (!Number.isFinite(percentual)) return 0;
  return Math.max(0, Math.min(100, percentual));
}

export function calcularPercentualPlanejadoServico(
  servico: ServicoPlanejado | ServicoDoSubpacote | null | undefined,
  dataReferencia?: DateInput,
): number {
  if (!servico) return 0;
  const referencia = toDate(dataReferencia ?? new Date()) ?? new Date();
  const inicio =
    getDateFromKeys(servico as ServicoDoSubpacote, [
      "dataInicio",
      "inicioPrevisto",
      "inicioPlanejado",
      "plannedStart",
      "startDate",
      "inicio",
    ]) ?? null;
  const fim =
    getDateFromKeys(servico as ServicoDoSubpacote, [
      "dataFim",
      "fimPrevisto",
      "fimPlanejado",
      "plannedEnd",
      "endDate",
      "fim",
    ]) ?? null;
  if (!inicio || !fim) return 0;
  if (fim.getTime() <= inicio.getTime()) return 0;

  const totalDias = Math.max(1, daysBetween(inicio, fim));
  const referenciaMs = referencia.getTime();
  const inicioMs = inicio.getTime();
  const fimMs = fim.getTime();

  if (referenciaMs <= inicioMs) {
    return 0;
  }
  if (referenciaMs >= fimMs) {
    return 100;
  }

  const diasDecorridos = daysBetween(inicio, referencia);
  return clampPercentage((diasDecorridos / totalDias) * 100);
}

export function mapearServicosPlanejados(
  servicos: ServicoPlanejado[] | null | undefined,
  dataReferencia?: DateInput,
): ServicoPlanejadoResumo[] {
  const referencia = toDate(dataReferencia ?? new Date()) ?? new Date();
  if (!Array.isArray(servicos)) return [];

  return servicos.map((servico) => {
    const percentualPlanejado = calcularPercentualPlanejadoServico(servico, referencia);
    const percentualReal =
      parsePercentual(servico.percentualRealAtual) ??
      parsePercentual(servico.percentualReal) ??
      parsePercentual(servico.percentualInformado) ??
      parsePercentual(servico.progressoReal) ??
      parsePercentual(servico.realProgress) ??
      parsePercentual(servico.currentProgress) ??
      0;

    let id: string | undefined;
    if (typeof servico.id === "string") {
      id = servico.id;
    } else if (typeof servico.id === "number" && Number.isFinite(servico.id)) {
      id = String(servico.id);
    }

    return {
      id,
      descricao: normalizeDescricao(servico),
      percentualPlanejado,
      percentualReal,
    };
  });
}
