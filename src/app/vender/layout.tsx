import type { Metadata } from 'next';
import Link from 'next/link';
import { Store } from 'lucide-react';
import { SignOut } from './SignOut';

export const metadata: Metadata = { title: { default: 'Minha loja', template: '%s · Minha loja' } };

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/vender" className="flex items-center gap-2 font-display text-[15px] font-bold"><Store className="h-5 w-5 text-accent-ink" /> Minha loja</Link>
          <SignOut />
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </div>
  );
}
