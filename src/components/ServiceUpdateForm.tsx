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
  subactivityId?: string;
  subactivityLabel?: string;
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

type ChecklistOption = { id: string; description: string };

type ServiceUpdateFormProps = {
  serviceId: string;
  lastProgress: number;
  suggestedPercent?: number;
  checklist: ChecklistOption[];
  defaultSubactivityId?: string | null;
  defaultSubactivityLabel?: string | null;
  onPersistSubactivity?: (subactivity: { id?: string; label?: string }) => void;
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

function clampPercentValue(value: unknown): number | undefined {
  if (value === "" || value === null || typeof value === "undefined") {
    return undefined;
  }

  const numericValue =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  const clamped = Math.min(100, Math.max(1, numericValue));
  return Number.parseFloat(clamped.toFixed(1));
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

const formSchema = z
  .object({
    start: z.string().min(1, "Início obrigatório"),
    end: z.string().min(1, "Fim obrigatório"),
    subactivityId: z.string().optional(),
    description: z.string().min(1, "Descreva o que foi realizado"),
    percent: z
      .number({ invalid_type_error: "Informe um percentual" })
      .refine((value) => Number.isFinite(value), { message: "Informe um percentual" })
      .min(1, "Mínimo 1%")
      .max(100, "Máximo 100%"),
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
  })
  .superRefine((values, ctx) => {
    const startDate = new Date(values.start);
    const endDate = new Date(values.end);
    if (Number.isNaN(startDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start"],
        message: "Data/hora inicial inválida",
      });
    }
    if (Number.isNaN(endDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "Data/hora final inválida",
      });
    }
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "Fim deve ser maior que o início",
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

function differenceInHours(start: string, end: string): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diff = (endDate.getTime() - startDate.getTime()) / 3_600_000;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff * 100) / 100;
}

export default function ServiceUpdateForm({
  serviceId,
  lastProgress,
  suggestedPercent,
  checklist,
  defaultSubactivityId,
  defaultSubactivityLabel,
  onPersistSubactivity,
  onSubmit,
}: ServiceUpdateFormProps) {
  const defaultSubactivityChoice = useMemo(() => {
    if (defaultSubactivityId && checklist.some((item) => item.id === defaultSubactivityId)) {
      return defaultSubactivityId;
    }

    if (defaultSubactivityLabel) {
      const matchingOption = checklist.find((item) => item.description === defaultSubactivityLabel);
      if (matchingOption) {
        return matchingOption.id;
      }
    }

    if (checklist.length > 0) {
      return checklist[0].id;
    }

    return "";
  }, [checklist, defaultSubactivityId, defaultSubactivityLabel]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      start: "",
      end: "",
      subactivityId: defaultSubactivityChoice || undefined,
      description: "",
      percent: undefined,
      resources: [],
      workforce: [{ role: "", quantity: 1 }],
      shifts: [],
      justification: "",
      declarationAccepted: false,
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const workforceArray = useFieldArray({ control, name: "workforce" });
  const shiftArray = useFieldArray({ control, name: "shifts" });

  const startValue = watch("start");
  const endValue = watch("end");
  const percentValue = watch("percent");
  const justification = watch("justification");
  const selectedResources = watch("resources");

  const numericPercent = useMemo(() => {
    if (typeof percentValue === "number" && Number.isFinite(percentValue)) {
      return percentValue;
    }
    return null;
  }, [percentValue]);

  const requiresJustification = useMemo(
    () => numericPercent !== null && numericPercent < lastProgress,
    [numericPercent, lastProgress],
  );

  useEffect(() => {
    if (!checklist.length) return;
    const current = getValues("subactivityId");
    if (current && checklist.some((item) => item.id === current)) {
      return;
    }
    if (defaultSubactivityChoice) {
      setValue("subactivityId", defaultSubactivityChoice, { shouldDirty: false });
    }
  }, [checklist, defaultSubactivityChoice, getValues, setValue]);

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

  const hours = useMemo(() => differenceInHours(startValue, endValue), [startValue, endValue]);

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
    if (checklist.length > 0 && !values.subactivityId) {
      form.setError("subactivityId", { type: "custom", message: "Selecione a subatividade" });
      return;
    }

    const startIso = new Date(values.start);
    const endIso = new Date(values.end);
    if (endIso < startIso) {
      form.setError("end", { type: "custom", message: "Fim deve ser maior que o início" });
      return;
    }

    if (requiresJustification && !values.justification?.trim()) {
      form.setError("justification", { type: "custom", message: "Informe o motivo da redução" });
      return;
    }

    const selectedSubactivity = (() => {
      const option = checklist.find((item) => item.id === values.subactivityId);
      if (option) {
        return { id: option.id, label: option.description };
      }
      return undefined;
    })();

    if (selectedSubactivity) {
      onPersistSubactivity?.({ id: selectedSubactivity.id, label: selectedSubactivity.label });
    }

    form.clearErrors("subactivityId");

    await onSubmit({
      percent: values.percent,
      description: values.description.trim(),
      start: startIso.toISOString(),
      end: endIso.toISOString(),
      subactivityId: selectedSubactivity?.id,
      subactivityLabel: selectedSubactivity?.label,
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

    const nextSubactivityId = selectedSubactivity?.id ?? (defaultSubactivityChoice || undefined);

    reset({
      start: "",
      end: "",
      subactivityId: nextSubactivityId,
      description: "",
      percent: undefined,
      resources: [],
      workforce: [{ role: "", quantity: 1 }],
      shifts: [],
      justification: "",
      declarationAccepted: false,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Percentual de conclusão</label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Último registro: {lastProgress.toFixed(1)}%</span>
            {Number.isFinite(suggestedPercent ?? NaN) ? (
              <span className="rounded-full bg-muted px-2 py-0.5">Sugerido: {Number(suggestedPercent).toFixed(1)}%</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          {numericPercent !== null ? (
            <span>{numericPercent.toFixed(1)}%</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${serviceId}-start`} className="text-sm font-medium text-foreground">
            Início
          </label>
          <input id={`${serviceId}-start`} type="datetime-local" className="input mt-1 w-full" {...register("start")} />
          {errors.start ? <p className="mt-1 text-xs text-destructive">{errors.start.message}</p> : null}
        </div>
        <div>
          <label htmlFor={`${serviceId}-end`} className="text-sm font-medium text-foreground">
            Fim
          </label>
          <input id={`${serviceId}-end`} type="datetime-local" className="input mt-1 w-full" {...register("end")} />
          {errors.end ? <p className="mt-1 text-xs text-destructive">{errors.end.message}</p> : null}
          {hours !== null ? <p className="mt-1 text-xs text-muted-foreground">Horas calculadas: {hours.toFixed(2)}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${serviceId}-subactivity`} className="text-sm font-medium text-foreground">
            Subatividade / Etapa
          </label>
          {checklist.length > 0 ? (
            <select id={`${serviceId}-subactivity`} className="input mt-1 w-full" {...register("subactivityId")}>
              <option value="">Selecione uma subatividade</option>
              {checklist.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.description}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" value="" readOnly {...register("subactivityId")} />
          )}
          {errors.subactivityId ? (
            <p className="mt-1 text-xs text-destructive">{errors.subactivityId.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label
            id={`${serviceId}-percent-label`}
            htmlFor={`${serviceId}-percent`}
            className="text-sm font-medium text-foreground"
          >
            Percentual total (1 a 100)
          </label>
          <div className="mt-1 flex w-full items-center gap-2 sm:w-48">
            <input
              id={`${serviceId}-percent`}
              type="number"
              inputMode="decimal"
              className="input flex-1"
              min={1}
              max={100}
              step={0.1}
              placeholder="1"
              {...register("percent", {
                setValueAs: clampPercentValue,
                onChange: (event) => {
                  const rawValue = event.target.value;

                  if (!rawValue) {
                    setValue("percent", undefined, { shouldDirty: true, shouldValidate: false });
                    return;
                  }

                  const numericValue = Number(rawValue.replace(",", "."));

                  if (!Number.isFinite(numericValue)) {
                    event.target.value = "";
                    setValue("percent", undefined, { shouldDirty: true, shouldValidate: false });
                    return;
                  }

                  const clamped = clampPercentValue(numericValue);

                  if (typeof clamped === "number") {
                    if (clamped !== numericValue) {
                      event.target.value = clamped.toString();
                    }
                    setValue("percent", clamped, { shouldDirty: true, shouldValidate: false });
                  }
                },
              })}
            />
            <span className="text-sm font-medium text-muted-foreground">%</span>
          </div>
          {errors.percent ? <p className="mt-1 text-xs text-destructive">{errors.percent.message}</p> : null}
        </div>
      </div>

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
