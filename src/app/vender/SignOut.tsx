'use client';

import { createClient } from '@/lib/supabase/client';

export function SignOut() {
  return (
    <button type="button" className="font-mono text-[12px] text-muted hover:text-ink"
      onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login'; }}>
      Sair
    </button>
  );
}
