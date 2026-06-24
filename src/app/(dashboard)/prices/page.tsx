'use client';
import { useEffect, useRef, useState } from 'react';

const CORPS = ['BATIMENT', 'VRD', 'ASSAINISSEMENT', 'AEP', 'ELECTRICITE', 'ECLAIRAGE', 'GENIE_CIVIL', 'ROUTES', 'ESPACES_VERTS', 'HYDRAULIQUE', 'AUTRE'];

function mad(n: number) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n || 0) + ' MAD'; }

export default function Prices() {
  const [prix, setPrix] = useState<any[]>([]);
  const [corps, setCorps] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ corpsEtat: 'BATIMENT', designation: '', unite: 'M2', prixUnitaire: '' });

  // --- Import ---
  const fileRef = useRef<HTMLInputElement>(null);
  const [imp, setImp] = useState({ source: '', annee: String(new Date().getFullYear()), corpsEtat: 'AUTRE' });
  const [importing, setImporting] = useState(false);
  const [resultat, setResultat] = useState<any>(null);

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

  async function importer() {
    const f = fileRef.current?.files?.[0];
    if (!f) { alert('Choisissez un fichier Excel (.xlsx, .xls ou .csv).'); return; }
    setImporting(true); setResultat(null);
    const fd = new FormData();
    fd.append('file', f);
    fd.append('source', imp.source);
    fd.append('annee', imp.annee);
    fd.append('corpsEtat', imp.corpsEtat);
    try {
      const res = await fetch('/api/prices/import', { method: 'POST', body: fd });
      const data = await res.json();
      setResultat(data);
      if (data.ok) { if (fileRef.current) fileRef.current.value = ''; setImp({ ...imp, source: '' }); charger(); }
    } catch (e: any) {
      setResultat({ ok: false, error: e.message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-8">
      <style>{`@media print { aside, .no-print { display: none !important; } main { width: 100% !important; } .card { box-shadow: none !important; } }`}</style>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bibliothèque de prix — Maroc</h1>
        <button onClick={() => window.print()} className="btn btn-ghost no-print">🖨️ Imprimer</button>
      </div>

      {/* IMPORT DE BORDEREAU */}
      <div className="card mb-6 no-print border-l-4 border-maroc-vert">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">📥</span>
          <h2 className="font-semibold">Importer un bordereau (Excel) pour enrichir la bibliothèque</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Colonnes reconnues : <b>Désignation</b>, <b>Unité</b>, <b>Prix</b> (Prix Unitaire HT). Optionnel : <b>Corps d'état</b>.
          Toutes les feuilles du classeur sont lues. Les doublons (même désignation + unité + prix) sont ignorés automatiquement. Les prix restent en HT.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="input md:col-span-2" />
          <input className="input" placeholder="Source (ex: Bordereau SG 2024)" value={imp.source} onChange={(e) => setImp({ ...imp, source: e.target.value })} />
          <input className="input" type="number" placeholder="Année" value={imp.annee} onChange={(e) => setImp({ ...imp, annee: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs text-slate-500">Corps d'état par défaut (si absent du fichier) :</label>
          <select className="input max-w-[200px]" value={imp.corpsEtat} onChange={(e) => setImp({ ...imp, corpsEtat: e.target.value })}>
            {CORPS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button onClick={importer} disabled={importing} className="btn btn-primary ml-auto whitespace-nowrap">
            {importing ? 'Import en cours…' : '📥 Importer le bordereau'}
          </button>
        </div>
        {resultat && (
          <div className={`mt-3 rounded-md p-3 text-sm ${resultat.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {resultat.ok ? (
              <>✅ {resultat.message} — <b>{resultat.inseres}</b> prix ajoutés
                {resultat.doublonsIgnores ? `, ${resultat.doublonsIgnores} doublon(s) ignoré(s)` : ''}.
                {' '}Bibliothèque : <b>{resultat.totalBibliotheque}</b> prix au total.</>
            ) : (
              <>❌ {resultat.error}</>
            )}
          </div>
        )}
      </div>

      {/* AJOUT MANUEL */}
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
            <tr><th className="p-3">Corps d'état</th><th className="p-3">Désignation</th><th className="p-3">Unité</th><th className="p-3 text-right">Prix unitaire</th><th className="p-3">Source</th><th className="p-3">Année</th></tr>
          </thead>
          <tbody>
            {prix.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="p-3"><span className="badge bg-slate-100 text-slate-600">{p.corpsEtat}</span></td>
                <td className="p-3">{p.designation}</td>
                <td className="p-3">{p.unite}</td>
                <td className="p-3 text-right font-medium">{mad(p.prixUnitaire)}</td>
                <td className="p-3 text-xs text-slate-500">{p.source || '—'}</td>
                <td className="p-3 text-slate-500">{p.annee}</td>
              </tr>
            ))}
            {prix.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Aucun prix.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
