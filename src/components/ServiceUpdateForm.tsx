"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const schema = z.object({
  progress: z.number().min(0).max(100),
  note: z.string().max(2000).optional(),
});

type FormData = z.infer<typeof schema>;

export default function ServiceUpdateForm({ lastProgress = 0, onSubmit }:{
  lastProgress?: number;
  onSubmit: (data: FormData) => Promise<void> | void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { progress: Math.max(lastProgress, 0), note: "" },
  });

  async function submit(data: FormData) {
    if (data.progress < lastProgress) {
      toast.error(`Novo progresso (${data.progress}%) não pode ser menor que o último (${lastProgress}%).`);
      return;
    }
    await onSubmit(data);
    toast.success("Atualização registrada");
    reset({ progress: data.progress, note: "" });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3">
      <div className="text-sm text-muted-foreground">Último progresso registrado: {lastProgress}%</div>
      <div>
        <label className="label" htmlFor="progress">
          Novo percentual (%)
        </label>
        <input
          id="progress"
          type="number"
          className="input mt-1 w-40"
          min={0}
          max={100}
          step={1}
          {...register("progress", { valueAsNumber: true })}
        />
        {errors.progress ? (
          <p className="mt-1 text-xs text-destructive">{errors.progress.message as string}</p>
        ) : null}
      </div>
      <div>
        <label className="label" htmlFor="note">
          Observações
        </label>
        <textarea
          id="note"
          className="input mt-1 min-h-[120px] resize-y"
          placeholder="Descreva a evolução do serviço"
          rows={3}
          {...register("note")}
        />
      </div>
      <button disabled={isSubmitting} className="btn-primary">
        {isSubmitting ? "Salvando…" : "Salvar atualização"}
      </button>
    </form>
  );
}
