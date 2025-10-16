import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/firebaseAdmin";
import { AccessTokenDoc, ServiceDoc, ServiceUpdate } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const { db, admin } = getAdmin();
    const body = await req.json();
    const { token, serviceId, items, totalPct, note, date: dateInput } = body ?? {};
    if (!token || !serviceId) return NextResponse.json({ ok:false, error:"missing_params" }, { status:400 });

    // validate token
    const ts = await db.collection("accessTokens").where("token","==",token).where("active","==",true).limit(1).get();
    if (ts.empty) return NextResponse.json({ ok:false, error:"invalid_token" }, { status:403 });

    const tokenData = ts.docs[0].data() as AccessTokenDoc;
    let allowed = false;
    if (tokenData.scope.type==="service" && tokenData.scope.serviceId===serviceId) allowed = true;
    if (tokenData.scope.type==="packageCompany") {
      const s = await db.collection("services").doc(serviceId).get();
      const d = s.data() as ServiceDoc | undefined;
      if (d?.pacoteId===tokenData.scope.pacoteId && d?.empresaId===tokenData.scope.empresaId) allowed = true;
    }
    if (!allowed) return NextResponse.json({ ok:false, error:"forbidden_scope" }, { status:403 });

    const ref = db.collection("services").doc(serviceId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok:false, error:"service_not_found" }, { status:404 });
    const svc = snap.data() as ServiceDoc;

    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp?.trim();

    // compose update doc
    let updateDate = admin.firestore.Timestamp.now();
    if (typeof dateInput === "string") {
      const parsed = new Date(dateInput);
      if (!Number.isNaN(parsed.getTime())) {
        updateDate = admin.firestore.Timestamp.fromDate(parsed);
      }
    }

    const upd: ServiceUpdate = {
      date: updateDate,
      note,
      by: "token",
      items: Array.isArray(items) ? items : undefined,
      totalPct: typeof totalPct === "number" ? totalPct : undefined,
      tokenId: ts.docs[0].id,
      ip: ip || undefined,
    };
    await ref.collection("serviceUpdates").add(upd);

    // recalc andamento
    let novo = 0;
    if (Array.isArray(svc.checklist) && svc.checklist.length > 0) {
      const pesoById = new Map(svc.checklist.map(i=>[i.id, i.peso]));
      const latest = new Map<string, number>();
      // pega o último % por item (inclui este update)
      const all = await ref.collection("serviceUpdates").orderBy("date","asc").get();
      for (const d of all.docs) {
        const u = d.data() as ServiceUpdate;
        if (u.items) for (const it of u.items) latest.set(it.itemId, it.pct);
      }
      let soma = 0;
      for (const [itemId, peso] of pesoById) {
        const p = latest.get(itemId) ?? 0;
        soma += (peso * p) / 100;
      }
      novo = Math.max(0, Math.min(100, soma));
    } else {
      // sem checklist: último totalPct
      const all = await ref.collection("serviceUpdates").orderBy("date","asc").get();
      for (const d of all.docs) {
        const u = d.data() as ServiceUpdate;
        if (typeof u.totalPct === "number") novo = u.totalPct;
      }
      novo = Math.max(0, Math.min(100, novo));
    }

    await ref.update({ andamento: novo, updatedAt: admin.firestore.Timestamp.now() });

    return NextResponse.json({ ok:true, andamento: novo });
  } catch (e:any) {
    if (e?.message === "ADMIN_ENVS_MISSING")
      return NextResponse.json({ ok:false, error:"admin_envs_missing" }, { status:503 });
    return NextResponse.json({ ok:false, error:"server_error" }, { status:500 });
  }
}
