'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const liens = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/projects', label: 'Mes métrés', icon: '📐' },
];

export default function SidebarNav({ user }: { user: { name?: string; email?: string; role?: string } }) {
  const path = usePathname();
  return (
    <aside className="flex w-64 flex-col bg-maroc-nuit text-white">
      <div className="flex items-center gap-2 px-5 py-5 text-lg font-bold">
        <span className="text-maroc-rouge">●</span> BTP Métré <span className="text-emerald-400">IA</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {liens.map((l) => {
          const actif = path === l.href || path.startsWith(l.href + '/');
          return (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${actif ? 'bg-white/15 font-medium' : 'text-slate-300 hover:bg-white/5'}`}>
              <span>{l.icon}</span> {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-slate-400">{user.role}</p>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="mt-3 w-full rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
