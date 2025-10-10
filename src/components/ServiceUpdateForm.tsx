"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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
      alert(`Novo progresso (${data.progress}%) não pode ser menor que o último (${lastProgress}%).`);
      return;
    }
    await onSubmit(data);
    reset({ progress: data.progress, note: "" });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-2">
      <div className="text-sm text-gray-600">Último %: {lastProgress}%</div>
      <input type="number" className="border rounded p-2 w-40" min={0} max={100} step={1} {...register("progress", { valueAsNumber: true })} />
      {errors.progress && <div className="text-xs text-red-600">{errors.progress.message as string}</div>}
      <textarea className="border rounded p-2 w-full max-w-xl" placeholder="Descrição do dia" rows={3} {...register("note")} />
      <button disabled={isSubmitting} className="px-4 py-2 rounded bg-black text-white">
        {isSubmitting ? "Salvando..." : "Salvar atualização"}
      </button>
    </form>
  );
}
