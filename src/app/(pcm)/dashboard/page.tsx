"use client";
import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, getCountFromServer } from "firebase/firestore";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [ativos, setAtivos] = useState<number>(0);
  const [concluidos, setConcluidos] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const db = getFirestore();
      const c1 = await getCountFromServer(query(collection(db, "services"), where("status", "==", "Aberto")));
      const c2 = await getCountFromServer(query(collection(db, "services"), where("status", "==", "Concluído")));
      setAtivos(c1.data().count);
      setConcluidos(c2.data().count);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container-page">
      <h1 className="mb-4">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm text-muted-foreground">Serviços em andamento</h3>
          <div className="text-3xl font-semibold mt-1">{loading ? "…" : ativos}</div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm text-muted-foreground">Serviços concluídos</h3>
          <div className="text-3xl font-semibold mt-1">{loading ? "…" : concluidos}</div>
        </div>
      </div>
    </div>
  );
}
