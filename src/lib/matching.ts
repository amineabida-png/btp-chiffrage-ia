// Correspondance lexicale robuste (TF-IDF + racinisation + synonymes métier BTP).
// Tourne en pur calcul Node : ne dépend ni des embeddings ni de pg_trgm.

const STOP = new Set(
  'de en le la les du des au aux sur et ou y compris pour avec d l par a type ht mad un une puis sans suivant detail tout toute toutes tous metre carre lineaire ml kg ft'.split(' ')
);

// Variantes -> forme canonique (pluriels, fautes, synonymes du bordereau)
const SYN: Record<string, string> = {
  agglos: 'agglo', agglo: 'agglo', agglomere: 'agglo', agglomeres: 'agglo', parpaing: 'agglo', parpaings: 'agglo',
  briques: 'brique', brik: 'brique',
  creuses: 'creux', creuse: 'creux', creu: 'creux',
  cloisons: 'cloison', plafonds: 'plafond', murs: 'mur', panneaux: 'panneau', voiles: 'voile', poteaux: 'poteau',
  enduits: 'enduit', interieurs: 'interieur', int: 'interieur', exterieurs: 'exterieur',
  isolant: 'isolation', isolante: 'isolation', isolations: 'isolation',
  doublages: 'doublage', peintures: 'peinture', revetements: 'revetement',
  polyurerthane: 'polyurethane', polyurethanne: 'polyurethane',
  vynilique: 'vinylique', vinyl: 'vinylique',
  carreaux: 'carreau', dalles: 'dalle', plinthes: 'plinthe', marches: 'marche',
  portes: 'porte', fenetres: 'fenetre', chassis: 'chassis',
};

// Actions/opérations : démolition/dépose ne doivent pas matcher de la pose (et inversement)
const ACTIONS = new Set('demolition depose decapage decappage grattage piquage curage demontage'.split(' '));

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
function normUnit(u: string): string {
  const x = (u || '').toUpperCase().trim();
  return x === 'M²' ? 'M2' : x;
}

export type Ref = { designation: string; unite: string; prixUnitaire: number };
type PreparedRef = { ref: Ref; vec: Map<string, number>; norm: number; nums: Set<string>; set: Set<string> };
export type Matcher = { prepared: PreparedRef[]; idf: Map<string, number>; N: number };

function buildVec(tk: string[], idf: Map<string, number>, N: number): Map<string, number> {
  const v = new Map<string, number>();
  const def = Math.log(N) + 1;
  for (const t of new Set(tk)) v.set(t, idf.get(t) ?? def);
  return v;
}
function vecNorm(v: Map<string, number>): number {
  let s = 0;
  for (const x of v.values()) s += x * x;
  return Math.sqrt(s);
}

/** Construit le moteur à partir de toute la bibliothèque (calcule l'IDF du corpus). */
export function construireMatcher(refs: Ref[]): Matcher {
  const docs = refs.map((r) => tokenize(r.designation));
  const N = refs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d.tk)) df.set(t, (df.get(t) || 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log(N / (1 + c)) + 1);
  const prepared: PreparedRef[] = refs.map((r, i) => {
    const vec = buildVec(docs[i].tk, idf, N);
    return { ref: r, vec, norm: vecNorm(vec), nums: docs[i].nums, set: new Set(docs[i].tk) };
  });
  return { prepared, idf, N };
}

export type Resultat = { prixUnitaire: number; designation: string; score: number } | null;

/** Trouve le meilleur prix de la bibliothèque pour une désignation+unité. null si rien de fiable. */
export function trouverPrix(designation: string, unite: string, m: Matcher, seuil = 0.3): Resultat {
  const { tk, nums: qn } = tokenize(designation);
  if (!tk.length) return null;
  const qv = buildVec(tk, m.idf, m.N);
  const qnorm = vecNorm(qv);
  const qset = new Set(tk);
  const u = normUnit(unite);
  const qHasAction = [...qset].some((a) => ACTIONS.has(a));

  let best: { score: number; ref: Ref } | null = null;
  for (const p of m.prepared) {
    if (u && normUnit(p.ref.unite) !== u) continue;
    // produit scalaire sur les termes communs
    let num = 0;
    for (const [t, w] of qv) { const pw = p.vec.get(t); if (pw) num += w * pw; }
    if (num === 0) continue;
    let sc = qnorm && p.norm ? num / (qnorm * p.norm) : 0;
    // nombres (épaisseurs, diamètres) : bonus si commun, malus si divergents
    if (qn.size && p.nums.size) {
      const commun = [...qn].some((x) => p.nums.has(x));
      sc += commun ? 0.08 : -0.1;
    }
    // action : démolition/dépose côté base mais pas demandé -> malus
    if (!qHasAction) { for (const a of p.set) { if (ACTIONS.has(a)) { sc -= 0.18; break; } } }
    if (!best || sc > best.score) best = { score: sc, ref: p.ref };
  }
  if (best && best.score >= seuil) {
    return { prixUnitaire: best.ref.prixUnitaire, designation: best.ref.designation, score: Math.round(best.score * 100) / 100 };
  }
  return null;
}
