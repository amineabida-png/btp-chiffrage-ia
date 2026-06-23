// Extraction PRÉCISE de la couche texte des plans PDF vectoriels (cotes, nomenclatures, tableaux)
// Utilise pdfjs : les valeurs sont exactes (pas d'OCR), idéal pour le métré.

export interface TextePlan { texte: string; echelle: string | null; vectoriel: boolean }

export async function extraireTextePlanPdf(buffer: Buffer, maxPages = 5): Promise<TextePlan> {
  try {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const nb = Math.min(doc.numPages, maxPages);
    let texte = '';
    for (let p = 1; p <= nb; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = (content.items || []).map((it: any) => (it.str || '')).filter(Boolean);
      texte += `\n--- Page ${p} ---\n` + items.join(' ');
    }
    texte = texte.trim();

    // Détection de l'échelle (1/100, 1:50, Ech 1/200...)
    let echelle: string | null = null;
    const m = texte.match(/(?:ech(?:elle)?\.?\s*:?\s*)?1\s*[\/:]\s*(\d{1,4})/i);
    if (m) echelle = `1/${m[1]}`;

    // Vectoriel si une couche texte significative existe
    const vectoriel = texte.length > 40;
    return { texte, echelle, vectoriel };
  } catch {
    return { texte: '', echelle: null, vectoriel: false };
  }
}
