"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type FeedbackState = {
  status: "idle" | "loading" | "error";
  message: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "Não foi possível validar o token.";
}

export function AcessoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [feedback, setFeedback] = useState<FeedbackState>({ status: "idle", message: "" });

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setFeedback({ status: "error", message: "Token não informado." });
      return () => {
        cancelled = true;
      };
    }

    async function validate() {
      setFeedback({ status: "loading", message: "Validando token…" });

      try {
        const response = await fetch(`/api/claim-access?token=${encodeURIComponent(token)}`, {
          method: "GET",
          cache: "no-store",
        });
        const json = await response.json().catch(() => ({}));

        if (!response.ok || json?.ok !== true) {
          const errorMessage = getErrorMessage(json?.error);
          throw new Error(errorMessage);
        }

        if (typeof json.redirectPath !== "string" || !json.redirectPath.trim()) {
          throw new Error("Destino do token não configurado.");
        }

        if (!cancelled) {
          router.replace(json.redirectPath);
        }
      } catch (error) {
        if (cancelled) return;
        setFeedback({ status: "error", message: getErrorMessage(error) });
      }
    }

    validate();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-3">Acesso por Token</h1>
      <p className="mb-2 text-sm text-gray-600">
        Token detectado: <b>{token || "(vazio)"}</b>
      </p>
      {feedback.message && (
        <p
          className={
            feedback.status === "error"
              ? "mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              : "mt-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
          }
        >
          {feedback.message}
        </p>
      )}
    </main>
  );
}
