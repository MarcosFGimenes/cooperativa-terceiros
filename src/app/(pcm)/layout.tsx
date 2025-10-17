"use client";
import { ReactNode, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function PcmLayout({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const off = onAuthStateChanged(auth, (u) => {
      setAuthed(!!u);
      setReady(true);
      if (!u) router.replace("/login");
    });
    return () => off();
  }, [router]);

  if (!ready) {
    return (
      <div className="container-page grid place-items-center">
        <div className="card p-6 text-sm text-muted-foreground">
          <span className="spinner mr-2" /> Carregando…
        </div>
      </div>
    );
  }

  if (!authed) return null;
  return <>{children}</>;
}
