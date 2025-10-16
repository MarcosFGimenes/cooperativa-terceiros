import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/firebaseAdmin";
import { AccessTokenDoc } from "@/types/domain";

export async function GET(req: NextRequest) {
  try {
    const { db } = getAdmin();
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ ok:false, error:"missing_token" }, { status:400 });

    const snap = await db.collection("accessTokens").where("token","==",token).where("active","==",true).limit(1).get();
    if (snap.empty) return NextResponse.json({ ok:true, found:false });

    const tokenRef = snap.docs[0].ref;
    const data = snap.docs[0].data() as AccessTokenDoc;

    let serviceIds: string[] = [];
    if (data.scope.type === "service") {
      serviceIds = [data.scope.serviceId];
    } else {
      // pacote + empresa => todos serviços do pacote para aquela empresa
      const q = await db.collection("services")
        .where("pacoteId","==",data.scope.pacoteId)
        .where("empresaId","==",data.scope.empresaId)
        .where("status","==","Aberto")
        .get();
      serviceIds = q.docs.map(d=>d.id);
    }

    return NextResponse.json({ ok:true, found:true, tokenId: tokenRef.id, scope: data.scope, serviceIds });
  } catch (e:any) {
    if (e?.message === "ADMIN_ENVS_MISSING")
      return NextResponse.json({ ok:false, error:"admin_envs_missing" }, { status:503 });
    return NextResponse.json({ ok:false, error:"server_error" }, { status:500 });
  }
}
