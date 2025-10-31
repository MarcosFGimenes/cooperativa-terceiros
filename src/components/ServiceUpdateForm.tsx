"use client";

import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export type ServiceUpdateFormPayload = {
  percent: number;
  description: string;
  start: string;
  end: string;
  date: string;
  subactivities: Array<{ id: string; label: string; progress?: number }>;
  resources: Array<{ name: string }>;
  workforce: Array<{ role: string; quantity: number }>;
  shiftConditions: Array<{
    shift: "manha" | "tarde" | "noite";
    weather: "claro" | "nublado" | "chuvoso";
    condition: "praticavel" | "impraticavel";
  }>;
  justification?: string;
  declarationAccepted: true;
};

type ChecklistOption = { id: string; description: string; progress?: number; weight?: number };

type ServiceUpdateFormProps = {
  serviceId: string;
  lastProgress: number;
  suggestedPercent?: number;
  checklist: ChecklistOption[];
  onSubmit: (payload: ServiceUpdateFormPayload) => Promise<void> | void;
};

const RESOURCE_OPTIONS = [
  { id: "andaimes", label: "Andaimes" },
  { id: "parafusadeiras", label: "Parafusadeiras" },
  { id: "maquina-solda", label: "Máquina de solda" },
  { id: "lixadeiras", label: "Lixadeiras" },
  { id: "serra-makita", label: "Serra tipo Makita" },
  { id: "escada", label: "Escada" },
  { id: "extensao", label: "Extensão" },
  { id: "furadeira", label: "Furadeira" },
  { id: "retifica", label: "Retífica" },
  { id: "cinto-seguranca", label: "Cinto de segurança" },
  { id: "plasma", label: "Plasma" },
];

const WORKFORCE_ROLES = [
  "Montador",
  "Caldeireiro",
  "Soldador",
  "Mecânico",
  "Ajudante",
  "Auxiliar",
  "Pedreiro",
  "Encarregado",
  "Engenheiro",
  "Eletricista",
  "Operador",
  "Motorista",
];

const SHIFT_OPTIONS = [
  { id: "manha" as const, label: "Manhã" },
  { id: "tarde" as const, label: "Tarde" },
  { id: "noite" as const, label: "Noite" },
];

const WEATHER_OPTIONS = [
  { id: "claro" as const, label: "Claro" },
  { id: "nublado" as const, label: "Nublado" },
  { id: "chuvoso" as const, label: "Chuvoso" },
];

const CONDITION_OPTIONS = [
  { id: "praticavel" as const, label: "Praticável" },
  { id: "impraticavel" as const, label: "Impraticável" },
];

function parseDateOnly(value: string): Date | null {
  if (!value || typeof value !== "string") return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function toDateRangeIso(value: string): { start: string; end: string } | null {
  const date = parseDateOnly(value);
  if (!date) return null;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function computeChecklistPercent(
  checklist: ChecklistOption[],
  subactivities: Array<{ progress?: number } | undefined> | undefined,
  fallback: number,
): number {
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return Math.round(fallback * 10) / 10;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  checklist.forEach((item, index) => {
    const baseProgress = (() => {
      const submitted = subactivities?.[index]?.progress;
      if (typeof submitted === "number" && Number.isFinite(submitted)) {
        return submitted;
      }
      if (typeof item.progress === "number" && Number.isFinite(item.progress)) {
        return item.progress;
      }
      return null;
    })();

    if (baseProgress === null) {
      return;
    }

    const weightValue =
      typeof item.weight === "number" && Number.isFinite(item.weight) && item.weight > 0
        ? item.weight
        : 1;

    weightedSum += weightValue * baseProgress;
    totalWeight += weightValue;
  });

  if (totalWeight === 0) {
    return Math.round(fallback * 10) / 10;
  }

  const computed = weightedSum / totalWeight;
  if (!Number.isFinite(computed)) {
    return Math.round(fallback * 10) / 10;
  }

  return Math.round(computed * 10) / 10;
}

function extractFieldErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (!("message" in value)) return null;
  const record = value as { message?: unknown };
  return typeof record.message === "string" ? record.message : null;
}

const workforceItemSchema = z.object({
  role: z.string().min(1, "Selecione a função"),
  quantity: z
    .coerce
    .number({ invalid_type_error: "Informe a quantidade" })
    .min(1, "Quantidade mínima 1")
    .max(999, "Quantidade inválida"),
});

const shiftDetailSchema = z.object({
  shift: z.enum(["manha", "tarde", "noite"]),
  weather: z.enum(["claro", "nublado", "chuvoso"]),
  condition: z.enum(["praticavel", "impraticavel"]),
});

const subactivitySchema = z.object({
  id: z.string(),
  progress: z
    .number({ invalid_type_error: "Informe o percentual da subatividade" })
    .min(0, "Mínimo 0%")
    .max(100, "Máximo 100%")
    .optional(),
});

const formSchema = z
  .object({
    date: z.string().min(1, "Data obrigatória"),
    description: z.string().min(1, "Descreva o que foi realizado"),
    justification: z.string().max(1000).optional(),
    declarationAccepted: z.literal(true, {
      errorMap: () => ({ message: "É necessário aceitar a declaração" }),
    }),
    resources: z.array(z.string()).default([]),
    workforce: z.array(workforceItemSchema).min(1, "Informe ao menos uma função"),
    shifts: z
      .array(shiftDetailSchema)
      .min(1, "Selecione ao menos um turno")
      .max(2, "Selecione até dois turnos"),
    subactivities: z.array(subactivitySchema).default([]),
  })
  .superRefine((values, ctx) => {
    if (!parseDateOnly(values.date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "Data inválida",
      });
    }
    const uniqueShifts = new Set(values.shifts.map((item) => item.shift));
    if (uniqueShifts.size !== values.shifts.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shifts"],
        message: "Cada turno deve ser informado apenas uma vez",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export default function ServiceUpdateForm({
  serviceId,
  lastProgress,
  suggestedPercent,
  checklist,
  onSubmit,
}: ServiceUpdateFormProps) {
  const checklistDefaults = useMemo(
    () =>
      checklist.map((item) => ({
        id: item.id,
        progress: undefined,
      })),
    [checklist],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: "",
      description: "",
      resources: [],
      workforce: [{ role: "", quantity: 1 }],
      shifts: [],
      justification: "",
      declarationAccepted: false,
      subactivities: checklistDefaults,
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const workforceArray = useFieldArray({ control, name: "workforce" });
  const shiftArray = useFieldArray({ control, name: "shifts" });

  const justification = watch("justification");
  const selectedResources = watch("resources");
  const subactivityValues = watch("subactivities");

  const computedPercent = useMemo(
    () => computeChecklistPercent(checklist, subactivityValues, lastProgress),
    [checklist, subactivityValues, lastProgress],
  );

  const requiresJustification = useMemo(
    () => Number.isFinite(computedPercent) && computedPercent < lastProgress,
    [computedPercent, lastProgress],
  );

  useEffect(() => {
    setValue("subactivities", checklistDefaults, { shouldDirty: false });
  }, [checklistDefaults, setValue]);

  useEffect(() => {
    if (requiresJustification && !justification) {
      form.setError("justification", {
        type: "custom",
        message: "Explique o motivo da redução",
      });
    } else {
      form.clearErrors("justification");
    }
  }, [form, justification, requiresJustification]);

  const selectedShifts = useMemo(() => shiftArray.fields.map((item) => item.shift), [shiftArray.fields]);

  function toggleResource(resourceId: string) {
    const current = new Set(selectedResources ?? []);
    if (current.has(resourceId)) {
      current.delete(resourceId);
    } else {
      current.add(resourceId);
    }
    setValue("resources", Array.from(current), { shouldDirty: true });
  }

  function toggleShift(shiftId: "manha" | "tarde" | "noite") {
    const index = shiftArray.fields.findIndex((item) => item.shift === shiftId);
    if (index >= 0) {
      shiftArray.remove(index);
      return;
    }
    if (shiftArray.fields.length >= 2) {
      return;
    }
    shiftArray.append({ shift: shiftId, weather: "claro", condition: "praticavel" });
  }

  async function submit(values: FormValues) {
    const range = toDateRangeIso(values.date);
    if (!range) {
      form.setError("date", { type: "custom", message: "Data inválida" });
      return;
    }

    if (requiresJustification && !values.justification?.trim()) {
      form.setError("justification", { type: "custom", message: "Informe o motivo da redução" });
      return;
    }

    const subactivityUpdates = values.subactivities
      .map((item, index) => {
        const meta = checklist[index];
        if (!meta) return null;
        const progress = typeof item?.progress === "number" && Number.isFinite(item.progress)
          ? Math.max(0, Math.min(100, Math.round(item.progress)))
          : undefined;
        return {
          id: meta.id,
          label: meta.description,
          progress,
        };
      })
      .filter((item): item is { id: string; label: string; progress?: number } => Boolean(item));

    const normalizedPercent = Number.isFinite(computedPercent) ? computedPercent : lastProgress;

    await onSubmit({
      percent: normalizedPercent,
      description: values.description.trim(),
      start: range.start,
      end: range.end,
      date: values.date,
      subactivities: subactivityUpdates,
      resources: (values.resources ?? [])
        .map((resourceId) => RESOURCE_OPTIONS.find((option) => option.id === resourceId)?.label ?? resourceId)
        .filter((label) => typeof label === "string" && label.trim().length > 0)
        .map((label) => ({ name: label })),
      workforce: values.workforce.map((item) => ({ role: item.role.trim(), quantity: Math.max(1, Math.round(item.quantity)) })),
      shiftConditions: values.shifts.map((item) => ({
        shift: item.shift,
        weather: item.weather,
        condition: item.condition,
      })),
      justification: values.justification?.trim() || undefined,
      declarationAccepted: true,
    });

    reset({
      date: "",
      description: "",
      resources: [],
      workforce: [{ role: "", quantity: 1 }],
      shifts: [],
      justification: "",
      declarationAccepted: false,
      subactivities: checklist.map((item) => ({ id: item.id, progress: undefined })),
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Percentual de conclusão</label>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Último registro: {lastProgress.toFixed(1)}%</span>
            {Number.isFinite(suggestedPercent ?? NaN) ? (
              <span className="w-fit rounded-full bg-muted px-2 py-0.5">
                Sugerido: {Number(suggestedPercent).toFixed(1)}%
              </span>
            ) : null}
            <span>Valor calculado automaticamente a partir das subatividades.</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <span>{Number.isFinite(computedPercent) ? computedPercent.toFixed(1) : "-"}%</span>
        </div>
      </div>

      <div>
        <label htmlFor={`${serviceId}-date`} className="text-sm font-medium text-foreground">
          Data
        </label>
        <input id={`${serviceId}-date`} type="date" className="input mt-1 w-full" {...register("date")} />
        {errors.date ? <p className="mt-1 text-xs text-destructive">{errors.date.message}</p> : null}
      </div>

      {checklist.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Subatividades / Etapas</h3>
          <p className="text-xs text-muted-foreground">
            Informe o percentual atualizado para cada subatividade de acordo com o progresso realizado.
          </p>
          <ul className="space-y-3 text-sm">
            {checklist.map((item, index) => {
              const fieldError = extractFieldErrorMessage(errors.subactivities?.[index]?.progress);
              const currentValue =
                typeof subactivityValues?.[index]?.progress === "number"
                  ? subactivityValues[index]?.progress
                  : undefined;
              return (
                <li key={item.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{item.description}</span>
                    <span className="text-xs text-muted-foreground">
                      Progresso atual registrado: {Math.round(item.progress ?? 0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`${serviceId}-subactivity-${item.id}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="0"
                      className="input w-24"
                      {...register(`subactivities.${index}.progress`, {
                        setValueAs: (value) => {
                          if (value === "" || value === null || typeof value === "undefined") {
                            return undefined;
                          }
                          const numeric = Number(String(value).replace(",", "."));
                          if (!Number.isFinite(numeric)) return undefined;
                          const clamped = Math.max(0, Math.min(100, Math.round(numeric)));
                          return clamped;
                        },
                      })}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    {typeof currentValue === "number" ? (
                      <span className="text-xs text-muted-foreground">Novo valor: {currentValue}%</span>
                    ) : null}
                  </div>
                  {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <label htmlFor={`${serviceId}-description`} className="text-sm font-medium text-foreground">
          Descrição do que foi realizado
        </label>
        <textarea
          id={`${serviceId}-description`}
          className="input mt-1 min-h-[120px] resize-y"
          placeholder="Detalhe as atividades executadas"
          {...register("description")}
        />
        {errors.description ? <p className="mt-1 text-xs text-destructive">{errors.description.message}</p> : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Recursos utilizados</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {RESOURCE_OPTIONS.map((resource) => {
            const checked = selectedResources?.includes(resource.id) ?? false;
            return (
              <label
                key={resource.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-muted bg-muted/40 p-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={() => toggleResource(resource.id)}
                />
                <span className="font-medium text-foreground">{resource.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Mão de obra</h3>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => workforceArray.append({ role: "", quantity: 1 })}
            disabled={workforceArray.fields.length >= 12}
          >
            Adicionar função
          </button>
        </div>
        {workforceArray.fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">Informe as funções e quantidades utilizadas.</p>
        ) : (
          <div className="space-y-2">
            {workforceArray.fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                <select className="input" {...register(`workforce.${index}.role` as const)}>
                  <option value="">Selecione</option>
                  {WORKFORCE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input"
                  min={1}
                  {...register(`workforce.${index}.quantity` as const, { valueAsNumber: true })}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => workforceArray.remove(index)}
                  disabled={workforceArray.fields.length === 1}
                >
                  Remover
                </button>
                {errors.workforce?.[index]?.role ? (
                  <p className="text-xs text-destructive sm:col-span-3">{errors.workforce[index]?.role?.message}</p>
                ) : null}
                {errors.workforce?.[index]?.quantity ? (
                  <p className="text-xs text-destructive sm:col-span-3">{errors.workforce[index]?.quantity?.message}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {typeof errors.workforce?.message === "string" ? (
          <p className="text-xs text-destructive">{errors.workforce.message}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Períodos trabalhados</h3>
        <div className="flex flex-wrap gap-2">
          {SHIFT_OPTIONS.map((option) => {
            const checked = selectedShifts.includes(option.id);
            const disabled = !checked && shiftArray.fields.length >= 2;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                  checked ? "border-primary bg-primary/10 text-primary" : "border-muted bg-muted/40"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={() => toggleShift(option.id)}
                  disabled={disabled}
                />
                {option.label}
              </label>
            );
          })}
        </div>
        {errors.shifts && !Array.isArray(errors.shifts) && typeof errors.shifts.message === "string" ? (
          <p className="text-xs text-destructive">{errors.shifts.message}</p>
        ) : null}
        {errors.shifts && !Array.isArray(errors.shifts)
          ? (() => {
              const message = extractFieldErrorMessage(errors.shifts?.root);
              return message ? <p className="text-xs text-destructive">{message}</p> : null;
            })()
          : null}
        {shiftArray.fields.length > 0 ? (
          <div className="space-y-3">
            {shiftArray.fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-muted p-3">
                <input type="hidden" value={field.shift} {...register(`shifts.${index}.shift` as const)} />
                <div className="text-sm font-semibold text-foreground">
                  {SHIFT_OPTIONS.find((option) => option.id === field.shift)?.label ?? field.shift}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tempo</label>
                    <select className="input mt-1" {...register(`shifts.${index}.weather` as const)}>
                      {WEATHER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Condição de trabalho</label>
                    <select className="input mt-1" {...register(`shifts.${index}.condition` as const)}>
                      {CONDITION_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Selecione até dois turnos trabalhados e informe as condições.</p>
        )}
        {Array.isArray(errors.shifts)
          ? errors.shifts.map((error, index) => (
              <div key={index} className="text-xs text-destructive">
                {error?.shift?.message || error?.weather?.message || error?.condition?.message}
              </div>
            ))
          : null}
      </div>

      {requiresJustification ? (
        <div>
          <label htmlFor={`${serviceId}-justification`} className="text-sm font-medium text-foreground">
            Justificativa para redução do percentual
          </label>
          <textarea
            id={`${serviceId}-justification`}
            className="input mt-1 min-h-[100px]"
            placeholder="Explique por que o percentual reduziu em relação ao registro anterior"
            {...register("justification")}
          />
          {errors.justification ? (
            <p className="mt-1 text-xs text-destructive">{errors.justification.message}</p>
          ) : null}
        </div>
      ) : null}

      <label className="flex items-start gap-2 rounded-lg border border-muted bg-muted/40 p-4 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" {...register("declarationAccepted")} />
        <span>
          Declaro que as informações fornecidas são verdadeiras e assumo responsabilidade pelas atualizações realizadas neste
          serviço.
        </span>
      </label>
      {errors.declarationAccepted ? (
        <p className="-mt-3 text-xs text-destructive">{errors.declarationAccepted.message}</p>
      ) : null}

      <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Registrar atualização"}
      </button>
    </form>
  );
}
