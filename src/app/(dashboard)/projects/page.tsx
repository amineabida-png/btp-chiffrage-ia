'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Projects() {
  const router = useRouter();
  const [projets, setProjets] = useState<any[]>([]);
  const [objet, setObjet] = useState('');
  const [loading, setLoading] = useState(false);

  async function charger() {
    const res = await fetch('/api/projects');
    setProjets(await res.json());
  }
  useEffect(() => { charger(); }, []);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objet }) });
    const p = await res.json();
    setLoading(false);
    router.push(`/projects/${p.id}`);
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Appels d'offres</h1>
      <form onSubmit={creer} className="card mb-6 flex gap-3">
        <input className="input" placeholder="Objet du nouvel appel d'offres…" value={objet} onChange={(e) => setObjet(e.target.value)} required />
        <button className="btn btn-primary whitespace-nowrap" disabled={loading}>{loading ? '…' : '+ Créer'}</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projets.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card transition hover:shadow-md">
            <div className="mb-2 flex items-start justify-between">
              <span className="badge bg-emerald-50 text-emerald-700">{p.statut}</span>
              {p.scoreRisque != null && <span className="badge bg-amber-50 text-amber-700">Risque {p.scoreRisque}</span>}
            </div>
            <h3 className="font-semibold line-clamp-2">{p.objet}</h3>
            <p className="mt-2 text-xs text-slate-500">
              {p._count?.documents || 0} docs · {p._count?.articles || 0} articles · {p._count?.alertes || 0} alertes
            </p>
          </Link>
        ))}
        {projets.length === 0 && <p className="text-sm text-slate-500">Aucun appel d'offres pour le moment.</p>}
      </div>
    </div>
  );
}
