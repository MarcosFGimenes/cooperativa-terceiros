import { db } from "./firebase";
import { addDoc, collection, serverTimestamp, getDocs, query, where, limit } from "firebase/firestore";

export function randomToken(len = 8) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
  let out = "";
  for (let i = 0; i < len; i++) out += a[Math.floor(Math.random() * a.length)];
  return out;
}

export async function createAccessToken(payload: {
  serviceId?: string;
  packageId?: string;
  empresa?: string;
}) {
  // garante unicidade simples
  let code = randomToken(8);
  for (let i = 0; i < 5; i++) {
    const q = query(collection(db, "accessTokens"), where("code", "==", code), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) break;
    code = randomToken(8);
  }
  await addDoc(collection(db, "accessTokens"), {
    code,
    status: "active",
    empresa: payload.empresa ?? null,
    serviceId: payload.serviceId ?? null,
    packageId: payload.packageId ?? null,
    createdAt: serverTimestamp(),
  });
  return code;
}
