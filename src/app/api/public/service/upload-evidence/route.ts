import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

import { requireServiceAccess, PublicAccessError } from "@/lib/public-access";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId")?.trim() ?? "";
    const token = searchParams.get("token")?.trim() ?? undefined;

    if (!serviceId) {
      return NextResponse.json({ ok: false, error: "serviceId obrigatório" }, { status: 400 });
    }

    await requireServiceAccess(token ?? "", serviceId);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Arquivo não enviado" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Envie apenas imagens" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: "Imagem deve ter até 10MB" }, { status: 400 });
    }

    const uploadUrl = process.env.CLOUDFLARE_R2_UPLOAD_URL;
    const uploadToken = process.env.CLOUDFLARE_R2_UPLOAD_TOKEN;
    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;

    if (!uploadUrl || !publicBase) {
      return NextResponse.json({ ok: false, error: "Storage de fotos ainda não configurado no ambiente" }, { status: 500 });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
    const objectKey = `services/${serviceId}/updates/${Date.now()}-${nanoid(8)}.${ext || "jpg"}`;

    const upstream = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        ...(uploadToken ? { Authorization: `Bearer ${uploadToken}` } : {}),
        "x-object-key": objectKey,
        "x-content-type": file.type,
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!upstream.ok) {
      return NextResponse.json({ ok: false, error: "Falha ao salvar foto no R2" }, { status: 502 });
    }

    const url = `${publicBase.replace(/\/$/, "")}/${objectKey}`;
    return NextResponse.json({ ok: true, evidence: { url, label: file.name } });
  } catch (error) {
    if (error instanceof PublicAccessError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[api/public/service/upload-evidence] erro", error);
    return NextResponse.json({ ok: false, error: "Erro ao enviar foto" }, { status: 500 });
  }
}
