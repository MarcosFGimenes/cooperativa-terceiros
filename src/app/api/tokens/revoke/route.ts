import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { db } = getAdmin();
    const { token } = await req.json();
    if (!token) return NextResponse.json({ ok:false, error:"missing_token" }, { status:400 });

    const snap = await db.collection("accessTokens").where("token","==",token).limit(1).get();
    if (snap.empty) return NextResponse.json({ ok:true, found:false });

    await snap.docs[0].ref.update({ active:false });
    return NextResponse.json({ ok:true, found:true });
  } catch (e:any) {
    if (e?.message === "ADMIN_ENVS_MISSING")
      return NextResponse.json({ ok:false, error:"admin_envs_missing" }, { status:503 });
    return NextResponse.json({ ok:false, error:"server_error" }, { status:500 });
  }
}
