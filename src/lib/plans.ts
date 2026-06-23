// Analyse des plans : couche texte vectorielle (cotes exactes) + vision -> quantités, puis comparaison DQE
import { askVisionJSON } from './ai';
import { imageVersDataUrl, pdfVersImages } from './ocr';
import { extraireTextePlanPdf } from './plan-text';

const PROMPT_PLAN = `Tu es un métreur BTP marocain expert en lecture de plans (architecture, béton armé, VRD, coffrage, ferraillage).
Calcule les QUANTITÉS exploitables : longueurs (ML), surfaces (M2), volumes (M3), terrassement, béton, acier (KG), réseaux, revêtements.
RÈGLE: utilise EN PRIORITÉ les COTES, DIMENSIONS et TABLEAUX exacts fournis dans le texte du plan (nomenclatures, tableaux de
ferraillage, légendes de surfaces) — ces valeurs sont fiables. Sers-toi de l'échelle pour les mesures non cotées. N'invente jamais une quantité.`;

export interface QuantitePlan { element: string; unite: string; quantite: number; source?: string }

export async function analyserPlan(buffer: Buffer, mimeType: string, nom: string): Promise<{ quantites: QuantitePlan[]; resume: string }> {
  const estPdf = mimeType === 'application/pdf' || nom.toLowerCase().endsWith('.pdf');

  // 1) Couche texte exacte (plans vectoriels)
  let textePlan = ''; let echelle: string | null = null; let vectoriel = false;
  if (estPdf) {
    const t = await extraireTextePlanPdf(buffer, 5);
    textePlan = t.texte; echelle = t.echelle; vectoriel = t.vectoriel;
  }

  // 2) Images (pour vision)
  let dataUrls: string[] = [];
  if (mimeType.startsWith('image/')) {
    dataUrls = [await imageVersDataUrl(buffer)];
  } else if (estPdf) {
    const imgs = await pdfVersImages(buffer, 5).catch(() => [] as Buffer[]);
    for (const b of imgs.slice(0, 5)) dataUrls.push(await imageVersDataUrl(b));
  }

  if (!dataUrls.length && !textePlan) return { quantites: [], resume: 'Plan non exploitable.' };

  const contexte = [
    echelle ? `Échelle détectée: ${echelle}.` : '',
    textePlan ? `TEXTE EXACT DU PLAN (cotes/tableaux/nomenclatures):\n"""${textePlan.slice(0, 20000)}"""` : '',
    `Renvoie: {"resume":"","quantites":[{"element":"","unite":"M3|M2|ML|KG|U","quantite":0,"source":"cote|tableau|échelle|vision"}]}`,
  ].filter(Boolean).join('\n');

  let res: any;
  if (dataUrls.length) {
    res = await askVisionJSON(PROMPT_PLAN, `Plan: ${nom}.\n${contexte}`, dataUrls).catch(() => null);
  }
  // Si pas d'image mais texte vectoriel exploitable, on peut quand même demander une analyse texte
  if (!res && textePlan) {
    res = await askVisionJSON(PROMPT_PLAN, `Plan (texte vectoriel uniquement): ${nom}.\n${contexte}`, []).catch(() => null);
  }
  if (!res) return { quantites: [], resume: 'Lecture du plan impossible.' };

  return {
    quantites: (res.quantites || []).map((q: any) => ({
      element: String(q.element || ''), unite: String(q.unite || 'U'),
      quantite: Number(q.quantite) || 0, source: q.source || (vectoriel ? 'plan vectoriel' : nom),
    })),
    resume: (echelle ? `[Échelle ${echelle}] ` : '') + (res.resume || ''),
  };
}

export function comparerPlanDQE(quantites: QuantitePlan[], articlesDQE: { designation: string; unite: string; quantite: number }[]) {
  return quantites.map((q) => {
    const mots = q.element.toLowerCase().split(/\s+/).filter((m) => m.length > 3);
    let best: any = null; let bestScore = 0;
    for (const a of articlesDQE) {
      if (a.unite.toUpperCase() !== q.unite.toUpperCase()) continue;
      const d = a.designation.toLowerCase();
      const score = mots.filter((m) => d.includes(m)).length;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    const quantiteDQE = best && bestScore > 0 ? best.quantite : null;
    const ecartPourcent = quantiteDQE && quantiteDQE > 0
      ? Math.round(((q.quantite - quantiteDQE) / quantiteDQE) * 1000) / 10 : null;
    return { ...q, quantiteDQE, ecartPourcent };
  });
}
