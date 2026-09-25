'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Enquanto o pagamento está em análise, confere de novo a cada 8 s (por até 10 min). */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 10 * 60_000) return clearInterval(id);
      router.refresh();
    }, 8000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
