// Module MÉTRÉ : à partir d'un plan (DXF, PDF, image), produit un métré détaillé et structuré.
// - DXF  : géométrie RÉELLE (longueurs/surfaces par calque) -> l'IA nomme et structure les ouvrages.
// - PDF  : couche texte (cotes/nomenclatures) + rendu image -> lecture par l'IA vision.
// - image: lecture par l'IA vision (cotes, légendes, tableaux).
// - DWG  : format binaire fermé -> non lisible côté serveur (guider vers export DXF/PDF).

import { askVisionJSON, askJSON } from './ai';
import { imageVersDataUrl, pdfVersImages } from './ocr';
import { extraireTextePlanPdf } from './plan-text';
import { parseDXF } from './dxf';

export interface LigneMetre {
  poste: string;        // corps d'état / lot (ex: "Gros œuvre", "Revêtements", "VRD")
  element: string;      // ouvrage (ex: "Maçonnerie agglos 20", "Dallage béton")
  localisation: string; // ex: "RDC - Chambre 1", "Niveau 1", "Façade Nord"
  unite: string;        // M2, M3, ML, U, KG
  quantite: number;
  modeCalcul: string;   // formule / origine (ex: "5,00 x 4,00 = 20 m²", "périmètre calque MURS")
  observations: string;
  source: string;       // nom du plan / nature (cote, géométrie DXF, vision)
}

export interface ResultatMetre { lignes: LigneMetre[]; resume: string; avertissement?: string }

const SYSTEME = `Tu es un métreur BTP marocain expert (architecture, structure béton armé, VRD, second œuvre).
Ta mission : produire un MÉTRÉ DÉTAILLÉ ET STRUCTURÉ à partir d'un plan.
RÈGLES STRICTES :
- Utilise EN PRIORITÉ les valeurs EXACTES fournies (géométrie DXF par calque, cotes, tableaux/nomenclatures). Ne jamais inventer une quantité.
- Pour chaque ouvrage identifiable, donne : poste (corps d'état), élément, localisation, unité (M2/M3/ML/U/KG), quantité, et le MODE DE CALCUL (formule ou origine de la mesure).
- Regroupe par poste. Sépare bien longueurs (ML), surfaces (M2), volumes (M3), comptages (U).
- Si une donnée manque pour calculer, NE l'invente pas : mets quantite 0 et explique en observations ce qu'il faut préciser.
- Sois exhaustif mais honnête : mieux vaut une ligne "à préciser" qu'un chiffre faux.`;

function schema(): string {
  return `Renvoie UNIQUEMENT ce JSON :
{"resume":"synthèse courte du plan et des hypothèses",
 "lignes":[{"poste":"","element":"","localisation":"","unite":"M2|M3|ML|U|KG","quantite":0,"modeCalcul":"","observations":""}]}`;
}

function estDXF(nom: string, buf: Buffer) {
  if (nom.toLowerCase().endsWith('.dxf')) return true;
  const tete = buf.subarray(0, 2048).toString('latin1');
  return /\n\s*SECTION\s*\n/.test(tete) && /ENTITIES|HEADER/.test(tete);
}
function estDWG(nom: string, buf: Buffer) {
  if (nom.toLowerCase().endsWith('.dwg')) return true;
  return buf.subarray(0, 6).toString('latin1').startsWith('AC10'); // signature DWG "AC10xx"
}

export async function analyserMetre(buffer: Buffer, mimeType: string, nom: string): Promise<ResultatMetre> {
  // 1) DWG : non lisible
  if (estDWG(nom, buffer)) {
    return {
      lignes: [],
      resume: '',
      avertissement: `Le fichier "${nom}" est au format DWG (binaire Autodesk), non lisible automatiquement. ` +
        `Exportez-le en DXF (géométrie exacte, recommandé) ou en PDF depuis votre logiciel CAO, puis réimportez-le.`,
    };
  }

  // 2) DXF : géométrie réelle -> structuration IA
  if (estDXF(nom, buffer)) {
    const g = parseDXF(buffer.toString('latin1'));
    const contexte = `PLAN DXF "${nom}" — GÉOMÉTRIE EXACTE EXTRAITE (déjà mesurée, en mètres) :\n${g.resume}\n\n` +
      `À partir de ces mesures exactes par calque, déduis les ouvrages et structure le métré. ` +
      `Les longueurs et surfaces ci-dessus sont fiables : appuie-toi dessus. ${schema()}`;
    const res = await askJSON(SYSTEME, contexte).catch(() => null);
    return formater(res, nom, `géométrie DXF`);
  }

  // 3) PDF / image : couche texte + vision
  const estPdf = mimeType === 'application/pdf' || nom.toLowerCase().endsWith('.pdf');
  let textePlan = ''; let echelle: string | null = null;
  if (estPdf) {
    const t = await extraireTextePlanPdf(buffer, 6).catch(() => ({ texte: '', echelle: null, vectoriel: false } as any));
    textePlan = t.texte; echelle = t.echelle;
  }
  let dataUrls: string[] = [];
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(nom)) {
    dataUrls = [await imageVersDataUrl(buffer)];
  } else if (estPdf) {
    const imgs = await pdfVersImages(buffer, 6).catch(() => [] as Buffer[]);
    for (const b of imgs.slice(0, 6)) dataUrls.push(await imageVersDataUrl(b));
  }

  if (!dataUrls.length && !textePlan) {
    return { lignes: [], resume: '', avertissement: `Plan "${nom}" non exploitable (ni image lisible, ni couche texte).` };
  }

  const contexte = [
    echelle ? `Échelle détectée : ${echelle}.` : '',
    textePlan ? `TEXTE EXACT DU PLAN (cotes, tableaux, nomenclatures) — fiable :\n"""${textePlan.slice(0, 18000)}"""` : '',
    schema(),
  ].filter(Boolean).join('\n');

  let res: any = null;
  if (dataUrls.length) res = await askVisionJSON(SYSTEME, `Plan "${nom}".\n${contexte}`, dataUrls).catch(() => null);
  if (!res && textePlan) res = await askJSON(SYSTEME, `Plan "${nom}" (texte vectoriel uniquement).\n${contexte}`).catch(() => null);

  return formater(res, nom, echelle ? `échelle ${echelle}` : 'vision/texte');
}

function formater(res: any, nom: string, sourceDefaut: string): ResultatMetre {
  if (!res) return { lignes: [], resume: '', avertissement: `Lecture du plan "${nom}" impossible (réessayez ou vérifiez la qualité du plan).` };
  const lignes: LigneMetre[] = (res.lignes || []).map((l: any) => ({
    poste: String(l.poste || 'Divers').trim(),
    element: String(l.element || '').trim(),
    localisation: String(l.localisation || '').trim(),
    unite: String(l.unite || 'U').toUpperCase().trim(),
    quantite: Math.round((Number(l.quantite) || 0) * 1000) / 1000,
    modeCalcul: String(l.modeCalcul || '').trim(),
    observations: String(l.observations || '').trim(),
    source: `${nom} (${sourceDefaut})`,
  })).filter((l: LigneMetre) => l.element);
  return { lignes, resume: String(res.resume || '') };
}
