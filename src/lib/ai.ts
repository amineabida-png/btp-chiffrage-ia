import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const VISION = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';

const MAX_OUT = Number(process.env.GROQ_MAX_TOKENS || 3000);
const MAX_IN_CHARS = Number(process.env.GROQ_MAX_INPUT_CHARS || 11000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parsing JSON tolérant : répare les réponses tronquées ou imparfaites */
function nettoyerJSON(text: string): any {
  let t = (text || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 1) tentative directe
  try { return JSON.parse(t); } catch {}

  // 2) isoler le bloc { ... }
  const start = t.indexOf('{');
  if (start === -1) throw new Error('Aucun JSON trouvé');
  t = t.slice(start);

  try { return JSON.parse(t); } catch {}

  // 3) réparation d'un JSON tronqué : on retire la fin incomplète,
  //    puis on referme les crochets/accolades ouverts.
  const reparer = (s: string): any | null => {
    // supprime une éventuelle virgule/élément final incomplet
    let cleaned = s.replace(/,\s*$/, '');
    // enlève le dernier fragment après la dernière virgule s'il est incomplet
    for (let cut = cleaned.length; cut > 0; cut--) {
      let candidate = cleaned.slice(0, cut);
      // équilibrer les guillemets
      const quotes = (candidate.match(/(?<!\\)"/g) || []).length;
      if (quotes % 2 !== 0) continue; // guillemet ouvert -> on raccourcit
      // fermer les structures ouvertes
      let depthC = 0, depthA = 0;
      for (const ch of candidate) {
        if (ch === '{') depthC++;
        else if (ch === '}') depthC--;
        else if (ch === '[') depthA++;
        else if (ch === ']') depthA--;
      }
      candidate = candidate.replace(/,\s*$/, '');
      candidate += ']'.repeat(Math.max(0, depthA)) + '}'.repeat(Math.max(0, depthC));
      try { return JSON.parse(candidate); } catch { /* on raccourcit encore */ }
    }
    return null;
  };

  const repaired = reparer(t);
  if (repaired) return repaired;

  // 4) dernier recours : la plus grande sous-chaîne {...} parsable
  const last = t.lastIndexOf('}');
  if (last > 0) {
    try { return JSON.parse(t.slice(0, last + 1)); } catch {}
  }
  throw new Error('Réponse IA non parsable');
}

async function chat(messages: any[], opts: { maxTokens?: number; vision?: boolean; json?: boolean } = {}): Promise<string> {
  const maxTokens = opts.maxTokens ?? MAX_OUT;
  let msgs = messages;
  let attempt = 0;
  while (true) {
    try {
      const body: any = {
        model: opts.vision ? VISION : MODEL,
        temperature: 0.1,
        max_tokens: maxTokens,
        messages: msgs,
      };
      if (opts.json) body.response_format = { type: 'json_object' };
      const r = await client.chat.completions.create(body);
      return (r.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    } catch (e: any) {
      attempt++;
      const status = e?.status || e?.response?.status;
      const msg = String(e?.message || '');
      if (status === 429 && attempt <= 6) {
        const m = msg.match(/try again in ([\d.]+)s/i);
        const wait = m ? Math.ceil(parseFloat(m[1]) * 1000) + 800 : 20000;
        await sleep(Math.min(wait, 65000));
        continue;
      }
      if (status === 413 && attempt <= 4) {
        msgs = msgs.map((mm: any) =>
          mm.role === 'user' && typeof mm.content === 'string'
            ? { ...mm, content: mm.content.slice(0, Math.floor(mm.content.length / 2)) }
            : mm
        );
        continue;
      }
      // response_format non supporté par le modèle -> on réessaie sans
      if (opts.json && /response_format|json/i.test(msg) && attempt <= 2) {
        opts = { ...opts, json: false };
        continue;
      }
      throw e;
    }
  }
}

export async function askJSON(systeme: string, contenu: string): Promise<any> {
  const out = await chat([
    { role: 'system', content: systeme + ' Réponds UNIQUEMENT avec un objet JSON valide complet, sans texte autour.' },
    { role: 'user', content: contenu.slice(0, MAX_IN_CHARS) },
  ], { json: true });
  return nettoyerJSON(out);
}

export async function askVision(systeme: string, texte: string, dataUrls: string[]): Promise<string> {
  const content: any[] = [{ type: 'text', text: texte.slice(0, MAX_IN_CHARS) }];
  for (const url of dataUrls.slice(0, 3)) content.push({ type: 'image_url', image_url: { url } });
  return chat([{ role: 'system', content: systeme }, { role: 'user', content }], { vision: true, maxTokens: 2048 });
}

export async function askVisionJSON(systeme: string, texte: string, dataUrls: string[]): Promise<any> {
  const out = await askVision(systeme + ' Réponds UNIQUEMENT en JSON valide complet.', texte, dataUrls);
  return nettoyerJSON(out);
}

export async function analyserMarche(texte: string) {
  const systeme = `Tu es un expert en marchés publics BTP au Maroc (décret n°2-22-431). Montants en Dirhams (MAD). Sois concis dans les listes.`;
  const contenu = `Analyse ce dossier d'appel d'offres BTP marocain et renvoie ce JSON exact (listes: 4 éléments max chacune):
{"objet":"","maitreOuvrage":"","maitreOeuvre":null,"montantEstimatif":null,"delaiExecution":"","lieuExecution":null,"cautionProvisoire":null,"cautionDefinitive":"","retenueGarantie":"","qualifications":"","classifications":"","penalitesRetard":"","modalitesPaiement":"","revisionPrix":"","conditionsAdministratives":[],"conditionsTechniques":[],"criteresEvaluation":[],"conditionsEliminatoires":[]}

Texte:
"""${texte.slice(0, MAX_IN_CHARS)}"""`;
  return askJSON(systeme, contenu);
}

export async function extraireArticles(texte: string) {
  const systeme = `Tu es un métreur expert BTP marocain. Tu extrais les lignes d'un bordereau (BPU) ou détail estimatif (DQE). Désignations courtes.`;
  const contenu = `Extrais les articles (50 max). Renvoie:
{"articles":[{"numeroPrix":"","designation":"","unite":"","quantite":0,"observations":null}]}
Texte:
"""${texte.slice(0, MAX_IN_CHARS)}"""`;
  const r = await askJSON(systeme, contenu);
  return r.articles || [];
}

export async function chiffrerArticle(
  article: { designation: string; unite: string },
  prixRef: { designation: string; prixUnitaire: number }[]
) {
  const systeme = `Économiste de la construction au Maroc. Sous-détails de prix en MAD HT, pratiques marocaines.`;
  const ref = prixRef.slice(0, 12).map((p) => `- ${p.designation}: ${p.prixUnitaire} MAD`).join('\n');
  const contenu = `Article: "${article.designation}" — Unité: ${article.unite}
Prix de référence similaires:
${ref || 'aucun'}
Renvoie (montants pour UNE unité, MAD HT):
{"prixFournitures":0,"prixMainOeuvre":0,"prixMateriel":0,"prixEngins":0,"prixTransport":0,"prixSousTraitance":0,"sousDetail":{"composants":[]},"commentaire":""}`;
  const out = await chat([
    { role: 'system', content: systeme + ' Réponds UNIQUEMENT en JSON.' },
    { role: 'user', content: contenu.slice(0, MAX_IN_CHARS) },
  ], { maxTokens: 1200, json: true });
  return nettoyerJSON(out);
}

export async function analyserRisques(texte: string, articles: any[]) {
  const systeme = `Expert en gestion des risques sur les marchés BTP au Maroc. Sois concis (6 risques et 6 alertes max).`;
  const resume = articles.slice(0, 40).map((a) => `${a.numeroPrix}|${a.designation}|${a.unite}|${a.quantite}`).join('\n').slice(0, 4000);
  const contenu = `Analyse les risques et la cohérence.
Extrait CPS/CCTP:
"""${texte.slice(0, 6000)}"""
Articles:
${resume}
Renvoie:
{"scoreRisque":0,"risques":[{"categorie":"TECHNIQUE|FINANCIER|CONTRACTUEL|DELAI|ADMINISTRATIF","description":"","niveau":"FAIBLE|MOYEN|ELEVE|CRITIQUE","recommandation":""}],"alertes":[{"type":"QUANTITE_ANORMALE|ARTICLE_MANQUANT|INCOHERENCE|ERREUR_CALCUL|RISQUE_FINANCIER|OUBLI","message":"","gravite":"FAIBLE|MOYEN|ELEVE|CRITIQUE"}]}`;
  return askJSON(systeme, contenu);
}

/** Découpe un texte volumineux en morceaux <= taille, en respectant les séparateurs de documents/feuilles */
function morceaux(texte: string, taille = MAX_IN_CHARS): string[] {
  const parts = texte.split(/\n(?==== )/); // sépare par "=== Document ===" / "=== Feuille: ... ==="
  const out: string[] = [];
  let buf = '';
  for (const p of parts) {
    if (p.length > taille) {
      if (buf) { out.push(buf); buf = ''; }
      for (let i = 0; i < p.length; i += taille) out.push(p.slice(i, i + taille));
    } else if (buf.length + p.length > taille) {
      if (buf) out.push(buf);
      buf = p;
    } else {
      buf += (buf ? '\n' : '') + p;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/** Extraction des articles sur un GROS document : traite chaque morceau (feuille/bloc) et fusionne, sans rien oublier */
export async function extraireArticlesGros(texte: string, maxMorceaux = 14) {
  const chunks = morceaux(texte, MAX_IN_CHARS).slice(0, maxMorceaux);
  const tous: any[] = [];
  const vus = new Set<string>();
  for (const c of chunks) {
    let arts: any[] = [];
    try { arts = await extraireArticles(c); } catch { /* on continue avec les autres morceaux */ }
    for (const a of arts) {
      const cle = (String(a.numeroPrix || '') + '|' + String(a.designation || '')).toLowerCase().trim();
      if (cle === '|' || vus.has(cle)) continue;
      vus.add(cle);
      tous.push(a);
    }
  }
  return tous;
}
