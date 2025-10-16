import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/firebaseAdmin";
import { makeToken } from "@/lib/tokens";
import { AccessTokenDoc } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    const { db, admin } = getAdmin();
    const body = await req.json();

    if (!body?.scope) return NextResponse.json({ ok:false, error:"missing_scope" }, { status:400 });
    const token = makeToken(16);

    const doc: AccessTokenDoc = {
      token,
      active: true,
      scope: body.scope,
      createdBy: "pcm",
      createdAt: admin.firestore.Timestamp.now(),
    };
    const ref = await db.collection("accessTokens").add(doc);
    return NextResponse.json({ ok:true, id: ref.id, token });
  } catch (e:any) {
    if (e?.message === "ADMIN_ENVS_MISSING")
      return NextResponse.json({ ok:false, error:"admin_envs_missing" }, { status:503 });
    return NextResponse.json({ ok:false, error:"server_error" }, { status:500 });
  }
}
