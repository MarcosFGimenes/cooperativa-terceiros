"use client";

import { useState, useTransition, FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

type DashboardFiltersProps = {
  companies: string[];
  packages: string[];
  current: {
    status?: string;
    company?: string;
    packageId?: string;
  };
};

const statuses = [
  { value: "", label: "Todos os status" },
  { value: "aberto", label: "Abertos" },
  { value: "concluido", label: "Concluídos" },
  { value: "encerrado", label: "Encerrados" },
];

export default function DashboardFilters({ companies, packages, current }: DashboardFiltersProps) {
  const [status, setStatus] = useState(current.status ?? "");
  const [company, setCompany] = useState(current.company ?? "");
  const [packageId, setPackageId] = useState(current.packageId ?? "");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (company) params.set("company", company);
    if (packageId) params.set("package", packageId);

    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    });
  }

  function resetFilters() {
    setStatus("");
    setCompany("");
    setPackageId("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Status</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Empresa</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          >
            <option value="">Todas</option>
            {companies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">Pacote</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={packageId}
            onChange={(event) => setPackageId(event.target.value)}
          >
            <option value="">Todos</option>
            {packages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isPending}
          >
            Limpar
          </button>
        </div>
      </div>
    </form>
  );
}
