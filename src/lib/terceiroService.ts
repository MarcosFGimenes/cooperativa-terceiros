// server-only
import "server-only";
import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

type ServiceDoc = {
  id: string;
  os?: string;
  oc?: string;
  tag?: string;
  equipamento?: string;
  setor?: string;
  status?: string;
  andamento?: number;
  packageId?: string | null;
  empresa?: string | null;
};

export async function getTokenDoc(token: string) {
  // Tenta Admin
  const adminDb = tryGetAdminDb();
  if (adminDb) {
    const snap = await adminDb.collection("accessTokens").where("code", "==", token).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as any;
  }
  // Fallback Web
  const webDb = await getServerWebDb();
  const { collection, getDocs, query, where, limit } = await import("firebase/firestore");
  const q = query(collection(webDb, "accessTokens"), where("code", "==", token), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as any;
}

export async function getServicesForToken(token: string): Promise<ServiceDoc[]> {
  const t = await getTokenDoc(token);
  if (!t) return [];
  const adminDb = tryGetAdminDb();

  // Caso 1: token vinculado a 1 serviço
  if (t.serviceId) {
    if (adminDb) {
      const doc = await adminDb.collection("services").doc(String(t.serviceId)).get();
      if (!doc.exists) return [];
      const data = doc.data() || {};
      if (data.status && data.status !== "Aberto") return [];
      return [{ id: doc.id, ...(data as any) }];
    } else {
      const webDb = await getServerWebDb();
      const { doc, getDoc } = await import("firebase/firestore");
      const dref = doc(webDb, "services", String(t.serviceId));
      const ds = await getDoc(dref);
      if (!ds.exists()) return [];
      const data = ds.data() || {};
      if ((data as any).status && (data as any).status !== "Aberto") return [];
      return [{ id: ds.id, ...(data as any) }];
    }
  }

  // Caso 2: token de pacote + empresa → lista serviços do pacote daquela empresa (status Aberto)
  if (t.packageId && t.empresa) {
    if (adminDb) {
      const snap = await adminDb
        .collection("services")
        .where("packageId", "==", String(t.packageId))
        .where("empresa", "==", String(t.empresa))
        .where("status", "==", "Aberto")
        .get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as ServiceDoc[];
    } else {
      const webDb = await getServerWebDb();
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const q = query(
        collection(webDb, "services"),
        where("packageId", "==", String(t.packageId)),
        where("empresa", "==", String(t.empresa)),
        where("status", "==", "Aberto"),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ServiceDoc[];
    }
  }

  return [];
}
