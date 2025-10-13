'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';

import { auth } from '@/lib/firebase';

export default function AcessoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Processando token…');
  const tokenId = searchParams.get('token');

  useEffect(() => {
    if (!tokenId) {
      setMessage('Token ausente na URL.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/claim-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenId }),
        });

        const data = await res.json();
        if (!res.ok) {
          const detail = data?.message || data?.error || 'Falha ao validar';
          throw new Error(detail);
        }

        const { customToken, targetType, targetId } = data;
        if (!customToken) throw new Error('Sem customToken.');

        await signInWithCustomToken(auth, customToken);

        if (targetType === 'service') router.replace(`/s/${targetId}`);
        else if (targetType === 'package') router.replace(`/p/${targetId}`);
        else router.replace('/');
      } catch (error: any) {
        setMessage(`Falha ao validar: ${error?.message || error}`);
      }
    })();
  }, [router, tokenId]);

  return <div className="p-6">{message}</div>;
}
