'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

function mad(n: number) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n || 0) + ' MAD'; }

export default function ProjetDetail() {
  const { id } = useParams<{ id: string }>();
  const [projet, setProjet] = useState<any>(null);
  const [onglet, setOnglet] = useState<'synthese' | 'bordereau' | 'plans' | 'risques'>('synthese');
  const [uploading, setUploading] = useState(false);
  const [analyse, setAnalyse] = useState(false);
  const [msg, setMsg] = useState('');
  const [coeffs, setCoeffs] = useState({ fraisChantier: 8, fraisGeneraux: 10, aleas: 3, marge: 8 });

  const charger = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProjet(await res.json());
  }, [id]);
  useEffect(() => { charger(); }, [charger]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploading(true); setMsg('');
    const fd = new FormData();
    fd.append('projetId', id);
    Array.from(e.target.files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    e.target.value = '';
    if (res.ok) { setMsg(`${data.documents.length} document(s) importé(s).`); charger(); }
    else setMsg(data.error || 'Erreur upload');
  }

  async function supprimerDoc(docId: string, nom: string) {
    if (!confirm(`Supprimer le document « ${nom} » ?`)) return;
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) { setMsg('Document supprimé.'); charger(); }
    else setMsg('Suppression impossible.');
  }

  async function lancerAnalyse() {
    setAnalyse(true); setMsg('Analyse IA en cours… (cela peut prendre 1 à 3 minutes)');
    const res = await fetch(`/api/projects/${id}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coefficients: coeffs }),
    });
    const data = await res.json();
    setAnalyse(false);
    if (res.ok) { setMsg(`Analyse terminée : ${data.articles} articles chiffrés.`); charger(); }
    else setMsg(data.error || 'Erreur analyse');
  }

  if (!projet) return <div className="p-8 text-slate-500">Chargement…</div>;

  const totalHT = (projet.articles || []).reduce((s: number, a: any) => s + (a.montantTotal || 0), 0);
  // Sur écran on n'affiche que l'onglet actif ; à l'impression, toutes les sections s'affichent.
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
          <p className="text-sm text-slate-500">Statut : {projet.statut} {projet.scoreRisque != null && `· Risque ${projet.scoreRisque}/100`}</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={() => window.print()} className="btn btn-ghost">🖨️ Imprimer le dossier</button>
          <a href={`/api/export/${id}?format=excel`} className="btn btn-ghost">⬇ Excel</a>
          <a href={`/api/export/${id}?format=pdf`} className="btn btn-ghost">⬇ Rapport PDF</a>
        </div>
      </div>

      {/* Zone import + analyse (non imprimée) */}
      <div className="card mb-6 no-print">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">1. Importer les documents</h3>
            <p className="mb-3 text-xs text-slate-500">BPU, DQE, CPS, CCTP, RC, plans PDF, Word, Excel, images scannées.</p>
            <input type="file" multiple onChange={onUpload} disabled={uploading}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-maroc-vert file:px-4 file:py-2 file:text-white" />
            <div className="mt-3 space-y-1">
              {(projet.documents || []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5 text-xs">
                  <span className="truncate">📄 {d.nom}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge bg-white text-slate-500">{d.type}</span>
                    <button onClick={() => supprimerDoc(d.id, d.nom)} title="Supprimer"
                      className="rounded px-1.5 text-red-600 hover:bg-red-100">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">2. Coefficients & analyse</h3>
            <div className="grid grid-cols-2 gap-2">
              {([['fraisChantier', 'Frais chantier'], ['fraisGeneraux', 'Frais généraux'], ['aleas', 'Aléas'], ['marge', 'Marge']] as const).map(([k, l]) => (
                <div key={k}>
                  <label className="label text-xs">{l} (%)</label>
                  <input className="input" type="number" value={(coeffs as any)[k]}
                    onChange={(e) => setCoeffs({ ...coeffs, [k]: Number(e.target.value) })} />
                </div>
              ))}
            </div>
            <button onClick={lancerAnalyse} disabled={analyse || (projet.documents || []).length === 0}
              className="btn btn-rouge mt-3 w-full">
              {analyse ? '⏳ Analyse en cours…' : '🤖 Lancer l\'analyse IA complète'}
            </button>
          </div>
        </div>
        {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      </div>

      {/* Onglets (non imprimés) */}
      <div className="mb-4 flex gap-2 border-b no-print">
        {([['synthese', 'Fiche synthèse'], ['bordereau', `Bordereau chiffré (${(projet.articles || []).length})`], ['plans', `Plans & métré (${(projet.metres || []).length})`], ['risques', `Risques & alertes (${(projet.alertes || []).length + (projet.risques || []).length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            className={`px-4 py-2 text-sm font-medium ${onglet === k ? 'border-b-2 border-maroc-vert text-maroc-vert' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      {/* SECTION 1 — Fiche synthèse */}
      <div className={sec('synthese')}>
        <h2 className="mb-2 hidden text-lg font-bold print:block">Fiche synthèse — {projet.objet}</h2>
        <div className="card">
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Objet', projet.objet], ['Maître d\'ouvrage', projet.maitreOuvrage], ['Maître d\'œuvre', projet.maitreOeuvre],
                ['Montant estimatif', projet.montantEstimatif ? mad(projet.montantEstimatif) : null], ['Délai d\'exécution', projet.delaiExecution],
                ['Lieu', projet.lieuExecution], ['Caution provisoire', projet.cautionProvisoire ? mad(projet.cautionProvisoire) : null],
                ['Caution définitive', projet.cautionDefinitive], ['Retenue de garantie', projet.retenueGarantie],
                ['Qualifications', projet.qualifications], ['Classifications', projet.classifications],
                ['Pénalités de retard', projet.penalitesRetard], ['Révision des prix', projet.revisionPrix],
                ['Modalités de paiement', projet.modalitesPaiement],
              ].map(([k, v]) => (
                <tr key={k as string} className="border-b last:border-0">
                  <td className="w-1/3 py-2 pr-4 font-medium text-slate-600">{k as string}</td>
                  <td className="py-2 text-slate-800">{(v as string) || <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2 — Bordereau chiffré */}
      <div className={sec('bordereau')}>
        <h2 className="mb-2 hidden text-lg font-bold print:block">Bordereau chiffré</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-2">N°</th><th className="p-2">Désignation</th><th className="p-2">U</th>
                <th className="p-2 text-right">Qté</th><th className="p-2 text-right">Déb. sec</th>
                <th className="p-2 text-right">P.U. HT</th><th className="p-2 text-right">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {(projet.articles || []).map((a: any) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="p-2">{a.numeroPrix}</td>
                  <td className="p-2 max-w-md">{a.designation}</td>
                  <td className="p-2">{a.unite}</td>
                  <td className="p-2 text-right">{a.quantite}</td>
                  <td className="p-2 text-right text-slate-500">{mad(a.deboursesSec)}</td>
                  <td className="p-2 text-right font-medium">{mad(a.prixUnitaire)}</td>
                  <td className="p-2 text-right font-semibold">{mad(a.montantTotal)}</td>
                </tr>
              ))}
              {(projet.articles || []).length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-400">Aucun article. Importez un BPU/DQE et lancez l'analyse IA.</td></tr>
              )}
            </tbody>
            {(projet.articles || []).length > 0 && (
              <tfoot className="bg-slate-50 font-semibold">
                <tr><td colSpan={6} className="p-2 text-right">TOTAL HT</td><td className="p-2 text-right">{mad(totalHT)}</td></tr>
                <tr><td colSpan={6} className="p-2 text-right">TVA 20 %</td><td className="p-2 text-right">{mad(totalHT * 0.2)}</td></tr>
                <tr className="text-maroc-vert"><td colSpan={6} className="p-2 text-right">TOTAL TTC</td><td className="p-2 text-right">{mad(totalHT * 1.2)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* SECTION 3 — Plans & métré */}
      <div className={sec('plans')}>
        <h2 className="mb-2 hidden text-lg font-bold print:block">Plans & métré</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-3">Élément détecté</th><th className="p-3">Unité</th>
                <th className="p-3 text-right">Qté plan</th><th className="p-3 text-right">Qté DQE</th>
                <th className="p-3 text-right">Écart</th><th className="p-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {(projet.metres || []).map((m: any) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="p-3">{m.element}</td>
                  <td className="p-3">{m.unite}</td>
                  <td className="p-3 text-right">{m.quantiteDetectee}</td>
                  <td className="p-3 text-right">{m.quantiteDQE ?? '—'}</td>
                  <td className={`p-3 text-right font-medium ${m.ecartPourcent != null && Math.abs(m.ecartPourcent) >= 10 ? 'text-maroc-rouge' : 'text-slate-500'}`}>
                    {m.ecartPourcent != null ? `${m.ecartPourcent > 0 ? '+' : ''}${m.ecartPourcent}%` : '—'}
                  </td>
                  <td className="p-3 text-slate-500">{m.source}</td>
                </tr>
              ))}
              {(projet.metres || []).length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">
                  Aucun métré. Importez un document nommé « plan… » (PDF ou image) : le métré est extrait automatiquement.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4 — Risques & alertes */}
      <div className={sec('risques')}>
        <h2 className="mb-2 hidden text-lg font-bold print:block">Risques & alertes</h2>
        <div className="space-y-4">
          <div className="card">
            <h3 className="mb-3 font-semibold">⚠️ Alertes de cohérence</h3>
            {(projet.alertes || []).length === 0 ? <p className="text-sm text-slate-400">Aucune alerte.</p> :
              (projet.alertes || []).map((a: any) => (
                <div key={a.id} className="mb-2 flex gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
                  <span className="badge bg-amber-200 text-amber-800">{a.gravite}</span>
                  <div><strong>{a.type}</strong> — {a.message}</div>
                </div>
              ))}
          </div>
          <div className="card">
            <h3 className="mb-3 font-semibold">🛡️ Analyse des risques</h3>
            {(projet.risques || []).length === 0 ? <p className="text-sm text-slate-400">Aucun risque identifié.</p> :
              (projet.risques || []).map((r: any) => (
                <div key={r.id} className="mb-3 rounded-lg border p-3 text-sm">
                  <div className="flex gap-2"><span className="badge bg-slate-100 text-slate-700">{r.categorie}</span><span className="badge bg-red-100 text-red-700">{r.niveau}</span></div>
                  <p className="mt-2">{r.description}</p>
                  {r.recommandation && <p className="mt-1 text-emerald-700">→ {r.recommandation}</p>}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
