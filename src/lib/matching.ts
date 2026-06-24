// Correspondance lexicale robuste pour le chiffrage depuis la bibliothèque.
// TF-IDF sur le "cœur" de la désignation + chevauchement pondéré + racinisation + synonymes BTP.
// Pur calcul Node : ne dépend NI des embeddings NI de pg_trgm. Conçu pour :
//  - matcher les désignations longues (sous-détails) sans se diluer,
//  - refuser les correspondances absurdes (étranger / hors-sujet -> "à chiffrer"),
//  - normaliser les unités hétérogènes (m², m lin, pièce, rouleau…).

const STOP = new Set(
  ('de en le la les du des au aux sur et ou y compris pour avec d l par a type ht mad un une puis sans ' +
   'suivant detail tout toute toutes tous metre carre lineaire ml kg ft hors yc cm mm ep dose dosee joints ' +
   'pose fourniture preparation support finition technique standard simple ordinaire classique local importation ' +
   'autre autres divers').split(' ')
);

const SYN: Record<string, string> = {
  agglos: 'agglo', agglo: 'agglo', agglomere: 'agglo', agglomeres: 'agglo', parpaing: 'agglo', parpaings: 'agglo',
  briques: 'brique', brik: 'brique',
  creuses: 'creux', creuse: 'creux', creu: 'creux',
  cloisons: 'cloison', plafonds: 'plafond', murs: 'mur', panneaux: 'panneau', voiles: 'voile', poteaux: 'poteau',
  enduits: 'enduit', interieurs: 'interieur', int: 'interieur', exterieurs: 'exterieur',
  isolant: 'isolation', isolante: 'isolation', isolations: 'isolation',
  doublages: 'doublage', peintures: 'peinture', revetements: 'revetement',
  carrelage: 'carreau', carrelages: 'carreau', carreaux: 'carreau', carreleage: 'carreau',
  dalles: 'dalle', plinthes: 'plinthe', marches: 'marche', moquettes: 'moquette',
  ceramique: 'cerame', chapes: 'chape',
  polyurerthane: 'polyurethane', polyurethanne: 'polyurethane',
  vynilique: 'vinylique', vinyl: 'vinylique',
  portes: 'porte', fenetres: 'fenetre',
};

const ACTIONS = new Set('demolition depose decapage decappage grattage piquage curage demontage'.split(' '));

const UMAP: Record<string, string> = {
  m2: 'M2', mc: 'M2', m3: 'M3', ml: 'ML', mlin: 'ML', mlineaire: 'ML',
  u: 'U', unite: 'U', piece: 'U', pce: 'U', kg: 'KG', ft: 'FT', forfait: 'FT',
  rouleau: 'ROULEAU', rlx: 'ROULEAU', l: 'L', litre: 'L', e: 'E',
};

function deacc(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function stem(w: string): string {
  w = SYN[w] || w;
  if (w.length > 4 && w.endsWith('s')) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('x')) w = w.slice(0, -1);
  return SYN[w] || w;
}
function tokenize(s: string): { tk: string[]; nums: Set<string> } {
  const d = deacc(s).replace(/[^a-z0-9]/g, ' ');
  const tk: string[] = [];
  const nums = new Set<string>();
  for (const w of d.split(/\s+/)) {
    if (!w) continue;
    if (/^\d+$/.test(w)) { nums.add(w); continue; }
    if (STOP.has(w) || w.length < 2) continue;
    tk.push(stem(w));
  }
  return { tk, nums };
}
function core(desig: string): string {
  return (desig.split(' - ')[0] || desig).split(/\btype\b/i)[0];
}
export function normUnit(u: string): string {
  const x = deacc(String(u || '')).replace(/[\s.]/g, '');
  if (x === 'm2' || x === 'm²' || x === 'mc') return 'M2';
  return UMAP[x] || String(u || '').toUpperCase().trim();
}

export type Ref = { designation: string; unite: string; prixUnitaire: number };
type PreparedRef = { ref: Ref; set: Set<string>; nums: Set<string>; mass: number; unite: string };
export type Matcher = { prepared: PreparedRef[]; idf: Map<string, number>; N: number };

export function construireMatcher(refs: Ref[]): Matcher {
  const cores = refs.map((r) => tokenize(core(r.designation)));
  const N = refs.length || 1;
  const df = new Map<string, number>();
  for (const c of cores) for (const t of new Set(c.tk)) df.set(t, (df.get(t) || 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log(N / (1 + c)) + 1);
  const def = Math.log(N) + 1;
  const w = (t: string) => idf.get(t) ?? def;
  const prepared: PreparedRef[] = refs.map((r, i) => {
    const set = new Set(cores[i].tk);
    const full = tokenize(r.designation);
    let mass = 0;
    for (const t of set) mass += w(t);
    return { ref: r, set, nums: full.nums, mass, unite: normUnit(r.unite) };
  });
  return { prepared, idf, N };
}

export type Resultat = { prixUnitaire: number; designation: string; score: number } | null;

export function trouverPrix(designation: string, unite: string, m: Matcher, seuil = 0.42): Resultat {
  const def = Math.log(m.N) + 1;
  const w = (t: string) => m.idf.get(t) ?? def;
  const { tk, nums: qn } = tokenize(designation);
  if (!tk.length) return null;
  const qset = new Set(tk);
  let qmass = 0;
  for (const t of qset) qmass += w(t);
  const u = normUnit(unite);
  const qHasAction = [...qset].some((a) => ACTIONS.has(a));

  let best: { score: number; ref: Ref } | null = null;
  for (const p of m.prepared) {
    if (u && p.unite !== u) continue;
    let cov = 0;
    for (const t of qset) if (p.set.has(t)) cov += w(t);
    if (cov === 0) continue;
    const overlap = cov / (Math.min(qmass, p.mass) || 1);
    const jaccard = cov / (qmass + p.mass - cov || 1);
    let sc = 0.6 * overlap + 0.4 * jaccard;
    if (qn.size && p.nums.size) {
      const commun = [...qn].some((x) => p.nums.has(x));
      sc += commun ? 0.05 : -0.06;
    }
    if (!qHasAction) { for (const a of p.set) { if (ACTIONS.has(a)) { sc -= 0.2; break; } } }
    if (sc > 1) sc = 1;
    if (!best || sc > best.score) best = { score: sc, ref: p.ref };
  }
  if (best && best.score >= seuil) {
    return { prixUnitaire: best.ref.prixUnitaire, designation: best.ref.designation, score: Math.round(best.score * 100) / 100 };
  }
  return null;
}
