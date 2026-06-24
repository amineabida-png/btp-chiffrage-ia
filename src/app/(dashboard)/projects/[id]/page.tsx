'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

export default function ProjetDetail() {
  const { id } = useParams<{ id: string }>();
  const [projet, setProjet] = useState<any>(null);
  const [onglet, setOnglet] = useState<'metre' | 'alertes'>('metre');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProjet(await res.json());
  }, [id]);
  useEffect(() => { charger(); }, [charger]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploading(true); setMsg('Lecture des plans et génération du métré en cours… (DXF instantané ; PDF/image peut prendre 1–2 min)');
    const fd = new FormData();
    fd.append('projetId', id);
    Array.from(e.target.files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    e.target.value = '';
    if (res.ok) { setMsg(`${data.documents.length} plan(s)/document(s) importé(s). Métré mis à jour.`); charger(); }
    else setMsg(data.error || 'Erreur lors de l\'import');
  }

  async function supprimerDoc(docId: string, nom: string) {
    if (!confirm(`Supprimer « ${nom} » ? Les lignes de métré issues de ce plan ne seront pas retirées automatiquement.`)) return;
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) { setMsg('Document supprimé.'); charger(); }
    else setMsg('Suppression impossible.');
  }

  if (!projet) return <div className="p-8 text-slate-500">Chargement…</div>;

  const metres = projet.metres || [];
  const sec = (k: string) => (onglet === k ? 'section-impr' : 'section-impr hide-screen');

  return (
    <div className="p-8">
      <style>{`
        .hide-screen { display: none; }
        @media print {
          @page { margin: 12mm; }
          aside, .no-print { display: none !important; }
          .hide-screen { display: block !important; }
          .section-impr { break-inside: avoid; margin-bottom: 14px; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          main { width: 100% !important; }
        }
      `}</style>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{projet.objet}</h1>
          <p className="text-sm text-slate-500">Métré · {metres.length} ligne(s)</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          {metres.length > 0 && <a href={`/api/projects/${id}/metre-export`} className="btn btn-primary">⬇️ Exporter le métré (Excel)</a>}
          <button onClick={() => window.print()} className="btn btn-ghost">🖨️ Imprimer</button>
        </div>
      </div>

      {/* Import des plans */}
      <div className="card mb-6 no-print">
        <h3 className="mb-2 font-semibold">Importer des plans</h3>
        <p className="mb-3 text-xs text-slate-500">
          <b>DXF</b> = quantités exactes (géométrie réelle, recommandé). <b>PDF</b> / <b>image</b> = lecture des cotes et nomenclatures par l'IA.
          Le <b>DWG</b> doit être exporté en DXF ou PDF depuis votre logiciel CAO.
        </p>
        <input type="file" multiple onChange={onUpload} disabled={uploading}
          accept=".dxf,.pdf,.png,.jpg,.jpeg,.webp,.dwg"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-maroc-vert file:px-4 file:py-2 file:text-white" />
        <div className="mt-3 space-y-1">
          {(projet.documents || []).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5 text-xs">
              <span className="truncate">📐 {d.nom}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="badge bg-white text-slate-500">{d.type}</span>
                <button onClick={() => supprimerDoc(d.id, d.nom)} title="Supprimer" className="rounded px-1.5 text-red-600 hover:bg-red-100">✕</button>
              </div>
            </div>
          ))}
        </div>
        {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      </div>

      {/* Onglets */}
      <div className="mb-4 flex gap-2 border-b no-print">
        {([['metre', `Métré (${metres.length})`], ['alertes', `Alertes (${(projet.alertes || []).length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            className={`px-4 py-2 text-sm font-medium ${onglet === k ? 'border-b-2 border-maroc-vert text-maroc-vert' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      {/* MÉTRÉ */}
      <div className={sec('metre')}>
        <h2 className="mb-2 hidden text-lg font-bold print:block">Métré détaillé — {projet.objet}</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-3">Poste</th><th className="p-3">Ouvrage</th><th className="p-3">Localisation</th>
                <th className="p-3">U</th><th className="p-3 text-right">Quantité</th>
                <th className="p-3">Mode de calcul</th><th className="p-3">Observations</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(
                metres.reduce((acc: any, m: any) => { (acc[m.poste || 'Divers'] ||= []).push(m); return acc; }, {})
              ).map(([poste, lignes]: any) => (
                <FragmentPoste key={poste} poste={poste} lignes={lignes} />
              ))}
              {metres.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-400">
                  Aucun métré pour l'instant. Importez un <b>plan</b> (DXF, PDF ou image) : le métré est extrait et structuré automatiquement.
                  <br />Le format <b>DXF</b> donne des quantités exactes (géométrie réelle).
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ALERTES (plans non lisibles, points à préciser) */}
      <div className={sec('alertes')}>
        <h2 className="mb-2 hidden text-lg font-bold print:block">Alertes</h2>
        <div className="card">
          {(projet.alertes || []).length === 0 ? <p className="text-sm text-slate-400">Aucune alerte.</p> :
            (projet.alertes || []).map((a: any) => (
              <div key={a.id} className="mb-2 flex gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
                <span className="badge bg-amber-200 text-amber-800">{a.gravite}</span>
                <div><strong>{a.type}</strong> — {a.message}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function FragmentPoste({ poste, lignes }: { poste: string; lignes: any[] }) {
  const totaux: Record<string, number> = {};
  for (const l of lignes) totaux[l.unite] = (totaux[l.unite] || 0) + (Number(l.quantiteDetectee) || 0);
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
  return (
    <>
      <tr className="bg-slate-100/70">
        <td colSpan={7} className="p-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-600">{poste}</td>
      </tr>
      {lignes.map((m) => (
        <tr key={m.id} className="border-b last:border-0 align-top">
          <td className="p-3 text-slate-400">—</td>
          <td className="p-3 font-medium">{m.element}</td>
          <td className="p-3 text-slate-500">{m.localisation || '—'}</td>
          <td className="p-3">{m.unite}</td>
          <td className="p-3 text-right font-medium">{fmt(m.quantiteDetectee)}</td>
          <td className="p-3 text-xs text-slate-500">{m.modeCalcul || '—'}</td>
          <td className="p-3 text-xs text-slate-500">{m.observations || '—'}</td>
        </tr>
      ))}
      <tr className="border-b bg-emerald-50/50 text-xs">
        <td className="p-2 px-3 text-slate-500" colSpan={4}>Sous-total {poste}</td>
        <td className="p-2 px-3 text-right font-semibold text-emerald-800" colSpan={3}>
          {Object.entries(totaux).map(([u, q]) => `${fmt(q)} ${u}`).join('  ·  ')}
        </td>
      </tr>
    </>
  );
}
