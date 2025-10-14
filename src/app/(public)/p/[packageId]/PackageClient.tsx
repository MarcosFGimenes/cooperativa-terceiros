"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Package, Service } from "@/lib/types";

type PackageResponse = {
  ok: true;
  package: Package;
  services: Service[];
};

type ErrorResponse = { ok: false; error?: string };

type Props = {
  packageId: string;
  token: string;
};

function formatPercent(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export default function PackageClient({ packageId, token }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PackageResponse | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    if (!token) {
      setError("Token não informado. Inclua ?token=... na URL.");
      setData(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public/package?packageId=${encodeURIComponent(packageId)}&token=${encodeURIComponent(token)}`);
        const json = (await response.json()) as PackageResponse | ErrorResponse;
        if (!response.ok || !json || json.ok === false) {
          const message = ("error" in json && json.error) ? json.error : "Falha ao carregar pacote";
          if (!cancelled) {
            setError(message);
            setData(null);
          }
          return;
        }
        if (!cancelled) {
          setData(json);
        }
      } catch (err: unknown) {
        console.error("[public/package] Falha ao carregar", err);
        if (!cancelled) {
          setError("Não foi possível carregar os dados do pacote.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [packageId, token, refreshIndex]);

  function triggerReload() {
    setRefreshIndex((index) => index + 1);
  }

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Pacote de serviços</h1>
          <p className="mt-2 text-sm text-gray-600">Informe um token válido para visualizar os serviços vinculados.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Pacote {packageId}</h1>
          <p className="text-sm text-gray-600">Acompanhe o progresso dos serviços utilizando o token fornecido.</p>
        </div>
      </section>

      {loading && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Carregando serviços do pacote...</p>
        </section>
      )}

      {error && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-600">Não foi possível carregar</h2>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button
            type="button"
            onClick={triggerReload}
            className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {data && !error && (
        <>
          <section className="space-y-2 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">{data.package.name || "Pacote sem nome"}</h2>
            <p className="text-sm text-gray-600">
              Serviços autorizados para visualização com este token.
            </p>
          </section>

          {data.services.length === 0 ? (
            <section className="rounded-lg border bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-600">Nenhum serviço disponível neste pacote para este token.</p>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.services.map((service) => (
                <div key={service.id} className="space-y-3 rounded-lg border bg-white p-5 shadow-sm">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {service.equipmentName || `Serviço ${service.os || service.id}`}
                    </h3>
                    <p className="text-sm text-gray-600">Tag: {service.tag || "—"}</p>
                    <p className="text-sm text-gray-600">OS: {service.os || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    <span>Status: {service.status ? service.status.toUpperCase() : "—"}</span>
                    <span className="font-semibold text-gray-900">{formatPercent(service.realPercent)}</span>
                  </div>
                  <Link
                    href={`/s/${service.id}?token=${encodeURIComponent(token)}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white"
                  >
                    Abrir serviço
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
