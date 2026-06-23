import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const VISION = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';

function nettoyerJSON(text: string): any {
  // retire un éventuel raisonnement <think>...</think> et les fences ```
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('Réponse IA non parsable');
}

/** Appel texte renvoyant du JSON */
export async function askJSON(systeme: string, contenu: string): Promise<any> {
  const r = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: systeme + ' Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.' },
      { role: 'user', content: contenu },
    ],
  });
  return nettoyerJSON(r.choices[0]?.message?.content || '');
}

/** Appel VISION (OCR / lecture de plans) — images en base64 data URLs */
export async function askVision(systeme: string, texte: string, dataUrls: string[]): Promise<string> {
  const content: any[] = [{ type: 'text', text: texte }];
  for (const url of dataUrls.slice(0, 5)) {
    content.push({ type: 'image_url', image_url: { url } });
  }
  const r = await client.chat.completions.create({
    model: VISION,
    temperature: 0.1,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: systeme },
      { role: 'user', content },
    ],
  });
  return (r.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export async function askVisionJSON(systeme: string, texte: string, dataUrls: string[]): Promise<any> {
  const out = await askVision(systeme + ' Réponds UNIQUEMENT en JSON valide.', texte, dataUrls);
  return nettoyerJSON(out);
}

/** 1. Fiche synthèse du marché (contexte marocain) */
export async function analyserMarche(texte: string) {
  const systeme = `Tu es un expert en marchés publics BTP au Maroc (décret n°2-22-431). Tous les montants sont en Dirhams (MAD).`;
  const contenu = `Analyse ce dossier d'appel d'offres BTP marocain et renvoie ce JSON exact:
{"objet":"","maitreOuvrage":"","maitreOeuvre":null,"montantEstimatif":null,"delaiExecution":"","lieuExecution":null,"cautionProvisoire":null,"cautionDefinitive":"","retenueGarantie":"","qualifications":"","classifications":"","penalitesRetard":"","modalitesPaiement":"","revisionPrix":"","conditionsAdministratives":[],"conditionsTechniques":[],"criteresEvaluation":[],"conditionsEliminatoires":[]}

Texte:
"""${texte.slice(0, 45000)}"""`;
  return askJSON(systeme, contenu);
}

/** 2. Extraction des articles du bordereau */
export async function extraireArticles(texte: string) {
  const systeme = `Tu es un métreur expert BTP marocain. Tu extrais les lignes d'un bordereau (BPU) ou détail estimatif (DQE).`;
  const contenu = `Extrais TOUS les articles. Renvoie:
{"articles":[{"numeroPrix":"","designation":"","unite":"","quantite":0,"observations":null}]}
Texte:
"""${texte.slice(0, 45000)}"""`;
  const r = await askJSON(systeme, contenu);
  return r.articles || [];
}

/** 3. Chiffrage IA d'un article (sous-détail de prix) */
export async function chiffrerArticle(
  article: { designation: string; unite: string },
  prixRef: { designation: string; prixUnitaire: number }[]
) {
  const systeme = `Tu es un économiste de la construction au Maroc. Sous-détails de prix conformes aux pratiques marocaines, en MAD HT. Base-toi sur les prix de référence quand ils correspondent.`;
  const ref = prixRef.slice(0, 20).map((p) => `- ${p.designation}: ${p.prixUnitaire} MAD`).join('\n');
  const contenu = `Article: "${article.designation}" — Unité: ${article.unite}
Prix de référence similaires:
${ref || 'aucun'}

Renvoie (montants pour UNE unité, MAD HT):
{"prixFournitures":0,"prixMainOeuvre":0,"prixMateriel":0,"prixEngins":0,"prixTransport":0,"prixSousTraitance":0,"sousDetail":{"composants":[{"designation":"","quantite":0,"unite":"","prixUnitaire":0,"rendement":null}]},"commentaire":""}`;
  return askJSON(systeme, contenu);
}

/** 4. Risques + alertes de cohérence */
export async function analyserRisques(texte: string, articles: any[]) {
  const systeme = `Tu es un expert en gestion des risques sur les marchés BTP au Maroc.`;
  const resume = articles.slice(0, 60).map((a) => `${a.numeroPrix}|${a.designation}|${a.unite}|${a.quantite}`).join('\n');
  const contenu = `Analyse les risques et la cohérence.
Extrait CPS/CCTP:
"""${texte.slice(0, 25000)}"""
Articles:
${resume}

Renvoie:
{"scoreRisque":0,"risques":[{"categorie":"TECHNIQUE|FINANCIER|CONTRACTUEL|DELAI|ADMINISTRATIF","description":"","niveau":"FAIBLE|MOYEN|ELEVE|CRITIQUE","recommandation":""}],"alertes":[{"type":"QUANTITE_ANORMALE|ARTICLE_MANQUANT|INCOHERENCE|ERREUR_CALCUL|RISQUE_FINANCIER|OUBLI","message":"","gravite":"FAIBLE|MOYEN|ELEVE|CRITIQUE"}]}`;
  return askJSON(systeme, contenu);
}
