import "server-only";
import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

// Normaliza status (aceita "ABERTO", "aberto", etc.)
export function normStatus(s?: string | null) {
  const v = (s ?? "").toString().trim().toLowerCase();
  if (v === "concluido" || v === "concluído") return "Concluído";
  if (v === "encerrado") return "Encerrado";
  return "Aberto";
}

// Mapeia doc -> objeto comum
function mapDoc(id: string, data: any) {
  return {
    id,
    os: data?.os ?? data?.O_S ?? data?.OS ?? null,
    oc: data?.oc ?? data?.O_C ?? data?.OC ?? null,
    tag: data?.tag ?? null,
    equipamento: data?.equipamento ?? data?.nomeEquipamento ?? null,
    setor: data?.setor ?? null,
    status: normStatus(data?.status),
    andamento: Number(data?.andamento ?? 0),
    packageId: data?.packageId ?? null,
    empresa: data?.empresa ?? null,
    createdAt: data?.createdAt ?? null,
    updatedAt: data?.updatedAt ?? null,
  };
}

/** Lista TODOS os serviços para o PCM (sem depender de índice; filtra em memória). */
export async function listServicesPCM() {
  const admin = tryGetAdminDb();
  if (admin) {
    const snap = await admin.collection("services").get();
    return snap.docs.map((d: any) => mapDoc(d.id, d.data()));
  }
  const db = await getServerWebDb();
  const { collection, getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, "services"));
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

/** Lista TODOS os pacotes para o PCM. */
export async function listPackagesPCM() {
  const admin = tryGetAdminDb();
  if (admin) {
    const snap = await admin.collection("packages").get();
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
  }
  const db = await getServerWebDb();
  const { collection, getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, "packages"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** Lista serviços vinculados a um token do Terceiro, tolerante a índices. */
export async function listServicesForToken(tokenDoc: any) {
  if (!tokenDoc) return [];
  const admin = tryGetAdminDb();

  // Caso 1: token de serviço único
  if (tokenDoc.serviceId) {
    if (admin) {
      const doc = await admin.collection("services").doc(String(tokenDoc.serviceId)).get();
      if (!doc.exists) return [];
      return [mapDoc(doc.id, doc.data())].filter((s) => s.status === "Aberto");
    } else {
      const db = await getServerWebDb();
      const { doc, getDoc } = await import("firebase/firestore");
      const dref = doc(db, "services", String(tokenDoc.serviceId));
      const ds = await getDoc(dref);
      if (!ds.exists()) return [];
      return [mapDoc(ds.id, ds.data())].filter((s) => s.status === "Aberto");
    }
  }

  // Caso 2: token de pacote + empresa
  // Estratégia sem índice composto: buscar por packageId + empresa (se falhar, buscar apenas por packageId e filtrar em memória).
  if (tokenDoc.packageId && tokenDoc.empresa) {
    const empresa = String(tokenDoc.empresa);
    const packageId = String(tokenDoc.packageId);

    if (admin) {
      try {
        const q = await admin
          .collection("services")
          .where("packageId", "==", packageId)
          .where("empresa", "==", empresa)
          .get();
        return q.docs.map((d: any) => mapDoc(d.id, d.data())).filter((s) => s.status === "Aberto");
      } catch (e) {
        // fallback: busca por packageId e filtra empresa em memória
        const q2 = await admin.collection("services").where("packageId", "==", packageId).get();
        return q2.docs
          .map((d: any) => mapDoc(d.id, d.data()))
          .filter((s) => s.empresa === empresa && s.status === "Aberto");
      }
    } else {
      const db = await getServerWebDb();
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      try {
        const q = query(
          collection(db, "services"),
          where("packageId", "==", packageId),
          where("empresa", "==", empresa),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => mapDoc(d.id, d.data())).filter((s) => s.status === "Aberto");
      } catch (e) {
        // fallback: só por packageId
        const q2 = query(collection(db, "services"), where("packageId", "==", packageId));
        const snap2 = await getDocs(q2);
        return snap2.docs
          .map((d) => mapDoc(d.id, d.data()))
          .filter((s) => s.empresa === empresa && s.status === "Aberto");
      }
    }
  }

  return [];
}
