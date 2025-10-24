"use client";

import { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export type ServiceUpdateFormPayload = {
  percent: number;
  description: string;
  start: string;
  end: string;
  subactivityId?: string;
  subactivityLabel?: string;
  mode: "simple" | "detailed";
  impediments: Array<{ type: string; durationHours?: number | null }>;
  resources: Array<{ name: string; quantity?: number | null; unit?: string | null }>;
  forecastDate?: string;
  criticality?: number | null;
  evidences: Array<{ url: string; label?: string | null }>;
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

const impedimentSchema = z.object({
  type: z.string().min(1, "Informe o tipo"),
  durationHours: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() ? Number(value) : null))
    .refine((value) => value === null || (!Number.isNaN(value) && value >= 0), {
      message: "Horas inválidas",
    }),
});

const resourceSchema = z.object({
  name: z.string().min(1, "Informe o recurso"),
  quantity: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() ? Number(value) : null))
    .refine((value) => value === null || (!Number.isNaN(value) && value >= 0), {
      message: "Quantidade inválida",
    }),
  unit: z.string().max(20).optional().transform((value) => (value && value.trim() ? value.trim() : undefined)),
});

const evidenceSchema = z.object({
  url: z.string().url("Informe uma URL válida"),
  label: z.string().max(120).optional().transform((value) => (value && value.trim() ? value.trim() : undefined)),
});

const formSchema = z
  .object({
    mode: z.enum(["simple", "detailed"]).default("simple"),
    start: z.string().min(1, "Início obrigatório"),
    end: z.string().min(1, "Fim obrigatório"),
    subactivityId: z.string().optional(),
    customSubactivity: z.string().optional(),
    description: z.string().min(1, "Descreva o que foi realizado"),
    percent: z
      .number({ invalid_type_error: "Informe um percentual" })
      .min(0, "Mínimo 0%")
      .max(100, "Máximo 100%"),
    justification: z.string().max(1000).optional(),
    declarationAccepted: z.literal(true, {
      errorMap: () => ({ message: "É necessário aceitar a declaração" }),
    }),
    impediments: z.array(impedimentSchema).max(5).default([]),
    resources: z.array(resourceSchema).max(8).default([]),
    forecastDate: z.string().optional(),
    criticality: z
      .number({ invalid_type_error: "Selecione a criticidade" })
      .min(1, "Mínimo 1")
      .max(5, "Máximo 5")
      .optional(),
    evidences: z.array(evidenceSchema).max(5).default([]),
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
    if (values.subactivityId === "__custom__" && !values.customSubactivity?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customSubactivity"],
        message: "Informe a subatividade",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

function toDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

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
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => now, [now]);
  const defaultStart = useMemo(() => {
    const start = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    start.setMinutes(Math.floor(start.getMinutes() / 15) * 15);
    return start;
  }, [now]);

  const defaultPercent = useMemo(() => {
    const suggestion = Number.isFinite(suggestedPercent ?? NaN) ? Number(suggestedPercent) : undefined;
    const base = Math.max(lastProgress, suggestion ?? lastProgress);
    return Math.min(100, Math.max(0, Math.round(base * 10) / 10));
  }, [lastProgress, suggestedPercent]);

  const defaultSubactivityChoice = useMemo(() => {
    if (defaultSubactivityId && checklist.some((item) => item.id === defaultSubactivityId)) {
      return { id: defaultSubactivityId, label: defaultSubactivityLabel ?? "", isCustom: false };
    }

    if (defaultSubactivityLabel) {
      return { id: "__custom__", label: defaultSubactivityLabel, isCustom: true };
    }

    if (checklist.length > 0) {
      return { id: checklist[0].id, label: checklist[0].description, isCustom: false };
    }

    return { id: "__custom__", label: "", isCustom: true };
  }, [checklist, defaultSubactivityId, defaultSubactivityLabel]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: "simple",
      start: toDateTimeLocal(defaultStart),
      end: toDateTimeLocal(defaultEnd),
      subactivityId: defaultSubactivityChoice.id,
      customSubactivity: defaultSubactivityChoice.isCustom ? defaultSubactivityChoice.label : "",
      description: "",
      percent: defaultPercent,
      justification: "",
      declarationAccepted: false,
      impediments: [],
      resources: [],
      forecastDate: "",
      criticality: 3,
      evidences: [],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const impedimentsArray = useFieldArray({ control, name: "impediments" });
  const resourcesArray = useFieldArray({ control, name: "resources" });
  const evidencesArray = useFieldArray({ control, name: "evidences" });

  const mode = watch("mode");
  const startValue = watch("start");
  const endValue = watch("end");
  const percent = watch("percent");
  const justification = watch("justification");
  const subactivityId = watch("subactivityId");

  const requiresJustification = useMemo(() => percent < lastProgress, [percent, lastProgress]);

  useEffect(() => {
    if (!subactivityId) return;
    if (subactivityId === "__custom__") return;
    const option = checklist.find((item) => item.id === subactivityId);
    if (option) {
      setValue("customSubactivity", option.description, { shouldDirty: false });
    }
  }, [checklist, setValue, subactivityId]);

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

  async function submit(values: FormValues) {
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
      if (values.subactivityId === "__custom__") {
        const custom = values.customSubactivity?.trim();
        if (!custom) return undefined;
        return { label: custom };
      }
      const option = checklist.find((item) => item.id === values.subactivityId);
      if (option) {
        return { id: option.id, label: option.description };
      }
      if (values.customSubactivity?.trim()) {
        return { label: values.customSubactivity.trim() };
      }
      return undefined;
    })();

    if (selectedSubactivity) {
      onPersistSubactivity?.({ id: selectedSubactivity.id, label: selectedSubactivity.label });
    }

    await onSubmit({
      percent: values.percent,
      description: values.description.trim(),
      start: startIso.toISOString(),
      end: endIso.toISOString(),
      subactivityId: selectedSubactivity?.id,
      subactivityLabel: selectedSubactivity?.label,
      mode: values.mode,
      impediments: values.impediments.map((item) => ({
        type: item.type.trim(),
        durationHours: item.durationHours ?? null,
      })),
      resources: values.resources.map((item) => ({
        name: item.name.trim(),
        quantity: item.quantity ?? null,
        unit: item.unit,
      })),
      forecastDate: values.forecastDate?.trim() ? new Date(values.forecastDate).toISOString() : undefined,
      criticality: typeof values.criticality === "number" ? values.criticality : null,
      evidences: values.evidences.map((item) => ({ url: item.url.trim(), label: item.label })),
      justification: values.justification?.trim() || undefined,
      declarationAccepted: true,
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
        <div className="flex items-center gap-2 text-xs">
          <span>Modo:</span>
          <label className="inline-flex items-center gap-1 text-xs font-medium">
            <input
              type="radio"
              value="simple"
              className="h-4 w-4"
              {...register("mode")}
              defaultChecked
            />
            Simples
          </label>
          <label className="inline-flex items-center gap-1 text-xs font-medium">
            <input type="radio" value="detailed" className="h-4 w-4" {...register("mode")}
            />
            Detalhado
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${serviceId}-start`} className="text-sm font-medium text-foreground">
            Início
          </label>
          <input
            id={`${serviceId}-start`}
            type="datetime-local"
            className="input mt-1 w-full"
            {...register("start")}
          />
          {errors.start ? <p className="mt-1 text-xs text-destructive">{errors.start.message}</p> : null}
        </div>
        <div>
          <label htmlFor={`${serviceId}-end`} className="text-sm font-medium text-foreground">
            Fim
          </label>
          <input id={`${serviceId}-end`} type="datetime-local" className="input mt-1 w-full" {...register("end")} />
          {errors.end ? <p className="mt-1 text-xs text-destructive">{errors.end.message}</p> : null}
          {hours !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">Horas calculadas: {hours.toFixed(2)}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor={`${serviceId}-percent`} className="text-sm font-medium text-foreground">
          Percentual total (0 a 100)
        </label>
        <input
          id={`${serviceId}-percent`}
          type="number"
          className="input mt-1 w-32"
          min={0}
          max={100}
          step={0.1}
          {...register("percent", { valueAsNumber: true })}
        />
        {errors.percent ? <p className="mt-1 text-xs text-destructive">{errors.percent.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor={`${serviceId}-subactivity`} className="text-sm font-medium text-foreground">
          Subatividade / Etapa
        </label>
        <select
          id={`${serviceId}-subactivity`}
          className="input mt-1 w-full"
          {...register("subactivityId")}
        >
          {checklist.map((item) => (
            <option key={item.id} value={item.id}>
              {item.description}
            </option>
          ))}
          <option value="__custom__">Outra / Geral</option>
        </select>
        {subactivityId === "__custom__" ? (
          <input
            type="text"
            className="input mt-2 w-full"
            placeholder="Descreva a subatividade"
            {...register("customSubactivity")}
          />
        ) : null}
        {subactivityId === "__custom__" && errors.customSubactivity ? (
          <p className="text-xs text-destructive">{errors.customSubactivity.message}</p>
        ) : null}
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

      {mode === "detailed" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Impedimentos / bloqueios</h3>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => impedimentsArray.append({ type: "", durationHours: null })}
                disabled={impedimentsArray.fields.length >= 5}
              >
                Adicionar
              </button>
            </div>
            {impedimentsArray.fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem impedimentos registrados.</p>
            ) : (
              <div className="space-y-2">
                {impedimentsArray.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                    <input
                      type="text"
                      className="input"
                      placeholder="Descrição do impedimento"
                      {...register(`impediments.${index}.type` as const)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Horas"
                      min={0}
                      step={0.5}
                      {...register(`impediments.${index}.durationHours` as const)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => impedimentsArray.remove(index)}
                    >
                      Remover
                    </button>
                    {errors.impediments?.[index]?.type ? (
                      <p className="text-xs text-destructive sm:col-span-3">
                        {errors.impediments[index]?.type?.message}
                      </p>
                    ) : null}
                    {errors.impediments?.[index]?.durationHours ? (
                      <p className="text-xs text-destructive sm:col-span-3">
                        {errors.impediments[index]?.durationHours?.message}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Recursos utilizados</h3>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => resourcesArray.append({ name: "", quantity: null, unit: undefined })}
                disabled={resourcesArray.fields.length >= 8}
              >
                Adicionar
              </button>
            </div>
            {resourcesArray.fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum recurso informado.</p>
            ) : (
              <div className="space-y-2">
                {resourcesArray.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_140px_auto]">
                    <input
                      type="text"
                      className="input"
                      placeholder="Equipe/equipamento"
                      {...register(`resources.${index}.name` as const)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Qtd"
                      min={0}
                      step={0.5}
                      {...register(`resources.${index}.quantity` as const)}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="Unidade"
                      {...register(`resources.${index}.unit` as const)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => resourcesArray.remove(index)}
                    >
                      Remover
                    </button>
                    {errors.resources?.[index]?.name ? (
                      <p className="text-xs text-destructive sm:col-span-4">
                        {errors.resources[index]?.name?.message}
                      </p>
                    ) : null}
                    {errors.resources?.[index]?.quantity ? (
                      <p className="text-xs text-destructive sm:col-span-4">
                        {errors.resources[index]?.quantity?.message}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${serviceId}-forecast`} className="text-sm font-medium text-foreground">
                Previsão de término
              </label>
              <input id={`${serviceId}-forecast`} type="date" className="input mt-1 w-full" {...register("forecastDate")} />
              {errors.forecastDate ? (
                <p className="mt-1 text-xs text-destructive">{errors.forecastDate.message}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor={`${serviceId}-criticality`} className="text-sm font-medium text-foreground">
                Criticidade observada (1-5)
              </label>
              <input
                id={`${serviceId}-criticality`}
                type="number"
                min={1}
                max={5}
                className="input mt-1 w-full"
                {...register("criticality", { valueAsNumber: true })}
              />
              {errors.criticality ? (
                <p className="mt-1 text-xs text-destructive">{errors.criticality.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Evidências</h3>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => evidencesArray.append({ url: "", label: "" })}
                disabled={evidencesArray.fields.length >= 5}
              >
                Adicionar
              </button>
            </div>
            {evidencesArray.fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Adicione links de evidências (ex.: fotos, relatórios).</p>
            ) : (
              <div className="space-y-2">
                {evidencesArray.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <input
                      type="url"
                      className="input"
                      placeholder="URL da evidência"
                      {...register(`evidences.${index}.url` as const)}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="Descrição (opcional)"
                      {...register(`evidences.${index}.label` as const)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => evidencesArray.remove(index)}
                    >
                      Remover
                    </button>
                    {errors.evidences?.[index]?.url ? (
                      <p className="text-xs text-destructive sm:col-span-3">
                        {errors.evidences[index]?.url?.message}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

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
        <input type="checkbox" className="mt-1 h-4 w-4" {...register("declarationAccepted")}
        />
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
