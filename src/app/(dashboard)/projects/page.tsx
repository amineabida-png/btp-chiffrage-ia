'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Projects() {
  const router = useRouter();
  const [projets, setProjets] = useState<any[]>([]);
  const [objet, setObjet] = useState('');
  const [loading, setLoading] = useState(false);
  const [suppr, setSuppr] = useState<string | null>(null);

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

  async function supprimer(e: React.MouseEvent, p: any) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Supprimer définitivement le métré « ${p.objet} » ?\n\nTous ses plans, lignes de métré et alertes seront effacés. Action irréversible.`)) return;
    setSuppr(p.id);
    const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' });
    setSuppr(null);
    if (res.ok) setProjets((list) => list.filter((x) => x.id !== p.id));
    else alert("La suppression a échoué. Réessayez.");
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Mes métrés</h1>
      <form onSubmit={creer} className="card mb-6 flex gap-3">
        <input className="input" placeholder="Objet du nouveau métré (ex: Villa R+1 Casablanca)…" value={objet} onChange={(e) => setObjet(e.target.value)} required />
        <button className="btn btn-primary whitespace-nowrap" disabled={loading}>{loading ? '…' : '+ Créer'}</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projets.map((p) => (
          <div key={p.id} className="card relative transition hover:shadow-md">
            <button
              onClick={(e) => supprimer(e, p)}
              disabled={suppr === p.id}
              title="Supprimer ce métré"
              className="absolute right-2 top-2 z-10 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {suppr === p.id ? '…' : '🗑'}
            </button>
            <Link href={`/projects/${p.id}`} className="block pr-8">
              <div className="mb-2 flex items-start justify-between">
                <span className="badge bg-emerald-50 text-emerald-700">{p.statut}</span>
                {p.scoreRisque != null && <span className="badge bg-amber-50 text-amber-700">Risque {p.scoreRisque}</span>}
              </div>
              <h3 className="font-semibold line-clamp-2">{p.objet}</h3>
              <p className="mt-2 text-xs text-slate-500">
                {p._count?.documents || 0} plan(s) · {p._count?.metres || 0} ligne(s) de métré · {p._count?.alertes || 0} alerte(s)
              </p>
            </Link>
          </div>
        ))}
        {projets.length === 0 && <p className="text-sm text-slate-500">Aucun métré pour le moment.</p>}
      </div>
    </div>
  );
}
