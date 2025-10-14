import { NextResponse } from "next/server";

import { PublicAccessError, fetchPackageServices, filterServicesByTokenCompany, requirePackageAccess } from "@/lib/public-access";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const packageId = searchParams.get("packageId") ?? "";
  const token = searchParams.get("token") ?? "";

  try {
    const { token: tokenData, pkg } = await requirePackageAccess(token, packageId);
    const services = await fetchPackageServices(pkg.id);
    const filtered = filterServicesByTokenCompany(services, tokenData);

    return NextResponse.json(
      {
        ok: true,
        package: pkg,
        services: filtered,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    if (err instanceof PublicAccessError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }

    console.error("[api/public/package] Falha inesperada", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
