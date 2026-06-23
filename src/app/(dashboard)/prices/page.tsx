'use client';
import { useEffect, useState } from 'react';

const CORPS = ['BATIMENT', 'VRD', 'ASSAINISSEMENT', 'AEP', 'ELECTRICITE', 'ECLAIRAGE', 'GENIE_CIVIL', 'ROUTES', 'ESPACES_VERTS', 'HYDRAULIQUE', 'AUTRE'];

function mad(n: number) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n || 0) + ' MAD'; }

export default function Prices() {
  const [prix, setPrix] = useState<any[]>([]);
  const [corps, setCorps] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ corpsEtat: 'BATIMENT', designation: '', unite: 'M2', prixUnitaire: '' });

  async function charger() {
    const params = new URLSearchParams();
    if (corps) params.set('corpsEtat', corps);
    if (q) params.set('q', q);
    const res = await fetch('/api/prices?' + params.toString());
    setPrix(await res.json());
  }
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [corps]);

  async function rechercheIntelligente() {
    if (!q.trim()) return charger();
    const res = await fetch('/api/prices/similar?q=' + encodeURIComponent(q));
    const data = await res.json();
    setPrix(data.map((p: any) => ({ ...p, corpsEtat: p.corpsEtat || '~', annee: p.annee || '', _score: p.score })));
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ ...form, designation: '', prixUnitaire: '' });
    charger();
  }

  return (
    <div className="p-8">
      <style>{`@media print { aside, .no-print { display: none !important; } main { width: 100% !important; } .card { box-shadow: none !important; } }`}</style>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bibliothèque de prix — Maroc</h1>
        <button onClick={() => window.print()} className="btn btn-ghost no-print">🖨️ Imprimer</button>
      </div>

      <form onSubmit={ajouter} className="card mb-6 grid gap-3 md:grid-cols-5 no-print">
        <select className="input" value={form.corpsEtat} onChange={(e) => setForm({ ...form, corpsEtat: e.target.value })}>
          {CORPS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="input md:col-span-2" placeholder="Désignation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
        <input className="input" placeholder="Unité" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} required />
        <div className="flex gap-2">
          <input className="input" type="number" placeholder="Prix MAD" value={form.prixUnitaire} onChange={(e) => setForm({ ...form, prixUnitaire: e.target.value })} required />
          <button className="btn btn-primary whitespace-nowrap">+ Ajouter</button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2 no-print">
        <button onClick={() => setCorps('')} className={`badge ${!corps ? 'bg-maroc-vert text-white' : 'bg-slate-200 text-slate-600'} cursor-pointer`}>Tous</button>
        {CORPS.map((c) => (
          <button key={c} onClick={() => setCorps(c)} className={`badge cursor-pointer ${corps === c ? 'bg-maroc-vert text-white' : 'bg-slate-200 text-slate-600'}`}>{c}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <input className="input" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && charger()} />
          <button onClick={charger} className="btn btn-ghost">Chercher</button>
          <button onClick={rechercheIntelligente} className="btn btn-primary whitespace-nowrap" title="Recherche par similarité (pg_trgm)">🔎 Similarité</button>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr><th className="p-3">Corps d'état</th><th className="p-3">Désignation</th><th className="p-3">Unité</th><th className="p-3 text-right">Prix unitaire</th><th className="p-3">Année</th></tr>
          </thead>
          <tbody>
            {prix.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="p-3"><span className="badge bg-slate-100 text-slate-600">{p.corpsEtat}</span></td>
                <td className="p-3">{p.designation}</td>
                <td className="p-3">{p.unite}</td>
                <td className="p-3 text-right font-medium">{mad(p.prixUnitaire)}</td>
                <td className="p-3 text-slate-500">{p.annee}</td>
              </tr>
            ))}
            {prix.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Aucun prix.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
