// Embeddings sémantiques 100% gratuits.
// Par défaut: modèle multilingue LOCAL (Transformers.js, aucune clé).
// Option: fournisseur hébergé gratuit (Jina) si EMBEDDINGS_PROVIDER=jina.
const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'local';
const MODEL = process.env.EMBEDDINGS_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

let extractor: any = null;
let loading: Promise<any> | null = null;

async function getExtractor() {
  if (extractor) return extractor;
  if (!loading) {
    loading = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      extractor = await pipeline('feature-extraction', MODEL);
      return extractor;
    })();
  }
  return loading;
}

function normaliser(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

/** Calcule l'embedding (vecteur normalisé) d'un texte. Renvoie [] si indisponible. */
export async function embed(texte: string): Promise<number[]> {
  const t = (texte || '').trim();
  if (!t) return [];
  try {
    if (PROVIDER === 'jina' && process.env.JINA_API_KEY) {
      const r = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JINA_API_KEY}` },
        body: JSON.stringify({ model: 'jina-embeddings-v3', input: [t] }),
      });
      const j = await r.json();
      return normaliser(j.data?.[0]?.embedding || []);
    }
    // LOCAL (par défaut)
    const ex = await getExtractor();
    const out = await ex(t, { pooling: 'mean', normalize: true });
    return Array.from(out.data as Float32Array);
  } catch {
    return []; // dégradation -> repli trigramme dans learning.ts
  }
}

/** Embeddings en lot */
export async function embedBatch(textes: string[]): Promise<number[][]> {
  const res: number[][] = [];
  for (const t of textes) res.push(await embed(t));
  return res;
}

/** Similarité cosinus entre deux vecteurs normalisés (= produit scalaire) */
export function cosinus(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
