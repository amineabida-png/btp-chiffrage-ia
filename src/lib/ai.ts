import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const VISION = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';

// Adaptés à la limite gratuite Groq (8 000 tokens/minute)
const MAX_OUT = Number(process.env.GROQ_MAX_TOKENS || 2048);
const MAX_IN_CHARS = Number(process.env.GROQ_MAX_INPUT_CHARS || 11000); // ~3300 tokens

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nettoyerJSON(text: string): any {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('Réponse IA non parsable');
}

/** Appel chat avec réessais automatiques sur limite de débit (429) et requête trop grosse (413) */
async function chat(messages: any[], opts: { maxTokens?: number; vision?: boolean } = {}): Promise<string> {
  const maxTokens = opts.maxTokens ?? MAX_OUT;
  let msgs = messages;
  let attempt = 0;
  while (true) {
    try {
      const r = await client.chat.completions.create({
        model: opts.vision ? VISION : MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: msgs,
      });
      return (r.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    } catch (e: any) {
      attempt++;
      const status = e?.status || e?.response?.status;
      const msg = String(e?.message || '');

      // Limite de tokens/minute atteinte -> on attend le délai indiqué puis on réessaie
      if (status === 429 && attempt <= 6) {
        const m = msg.match(/try again in ([\d.]+)s/i);
        const wait = m ? Math.ceil(parseFloat(m[1]) * 1000) + 800 : 20000;
        await sleep(Math.min(wait, 65000));
        continue;
      }
      // Requête trop grosse -> on réduit le contenu de moitié et on réessaie
      if (status === 413 && attempt <= 4) {
        msgs = msgs.map((mm: any) =>
          mm.role === 'user' && typeof mm.content === 'string'
            ? { ...mm, content: mm.content.slice(0, Math.floor(mm.content.length / 2)) }
            : mm
        );
        continue;
      }
      throw e;
    }
  }
}

export async function askJSON(systeme: string, contenu: string): Promise<any> {
  const out = await chat([
    { role: 'system', content: systeme + ' Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.' },
    { role: 'user', content: contenu.slice(0, MAX_IN_CHARS) },
  ]);
  return nettoyerJSON(out);
}

export async function askVision(systeme: string, texte: string, dataUrls: string[]): Promise<string> {
  const content: any[] = [{ type: 'text', text: texte.slice(0, MAX_IN_CHARS) }];
  for (const url of dataUrls.slice(0, 3)) content.push({ type: 'image_url', image_url: { url } });
  return chat([{ role: 'system', content: systeme }, { role: 'user', content }], { vision: true, maxTokens: 2048 });
}

export async function askVisionJSON(systeme: string, texte: string, dataUrls: string[]): Promise<any> {
  const out = await askVision(systeme + ' Réponds UNIQUEMENT en JSON valide.', texte, dataUrls);
  return nettoyerJSON(out);
}

export async function analyserMarche(texte: string) {
  const systeme = `Tu es un expert en marchés publics BTP au Maroc (décret n°2-22-431). Montants en Dirhams (MAD).`;
  const contenu = `Analyse ce dossier d'appel d'offres BTP marocain et renvoie ce JSON exact:
{"objet":"","maitreOuvrage":"","maitreOeuvre":null,"montantEstimatif":null,"delaiExecution":"","lieuExecution":null,"cautionProvisoire":null,"cautionDefinitive":"","retenueGarantie":"","qualifications":"","classifications":"","penalitesRetard":"","modalitesPaiement":"","revisionPrix":"","conditionsAdministratives":[],"conditionsTechniques":[],"criteresEvaluation":[],"conditionsEliminatoires":[]}

Texte:
"""${texte.slice(0, MAX_IN_CHARS)}"""`;
  return askJSON(systeme, contenu);
}

export async function extraireArticles(texte: string) {
  const systeme = `Tu es un métreur expert BTP marocain. Tu extrais les lignes d'un bordereau (BPU) ou détail estimatif (DQE).`;
  const contenu = `Extrais TOUS les articles. Renvoie:
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
  ], { maxTokens: 1200 });
  return nettoyerJSON(out);
}

export async function analyserRisques(texte: string, articles: any[]) {
  const systeme = `Expert en gestion des risques sur les marchés BTP au Maroc.`;
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
