// OCR intelligent : images + PDF scannés -> texte (via modèle vision Groq)
import sharp from 'sharp';
import { askVision } from './ai';

const PROMPT_OCR = `Tu es un moteur OCR expert pour documents BTP marocains.
Transcris FIDÈLEMENT tout le texte visible de l'image. Pour les TABLEAUX (bordereaux des prix, détails estimatifs),
restitue chaque ligne au format: N°prix | Désignation | Unité | Quantité | Observations (sépare les colonnes par " | ").
Ne résume pas, ne commente pas : transcris uniquement le contenu.`;

/** Convertit un buffer image en data URL JPEG redimensionnée (< 4 Mo base64) */
export async function imageVersDataUrl(buffer: Buffer): Promise<string> {
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const maxW = 1600;
  let pipeline = img;
  if ((meta.width || 0) > maxW) pipeline = pipeline.resize({ width: maxW });
  const jpeg = await pipeline.jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** OCR d'une image unique */
export async function ocrImage(buffer: Buffer): Promise<string> {
  const url = await imageVersDataUrl(buffer);
  return askVision(PROMPT_OCR, 'Transcris ce document.', [url]);
}

/** Rastérise un PDF en images PNG (une par page), via pdf2pic (gm + ghostscript) */
export async function pdfVersImages(buffer: Buffer, maxPages = 10): Promise<Buffer[]> {
  try {
    const { fromBuffer } = await import('pdf2pic');
    const convert = fromBuffer(buffer, {
      density: 150, format: 'png', width: 1600, height: 2200,
    });
    const images: Buffer[] = [];
    for (let p = 1; p <= maxPages; p++) {
      try {
        const res: any = await convert(p, { responseType: 'buffer' });
        if (res?.buffer) images.push(res.buffer);
        else break;
      } catch { break; } // plus de pages
    }
    return images;
  } catch (e) {
    throw new Error('Rastérisation PDF indisponible (ghostscript/graphicsmagick requis): ' + (e as Error).message);
  }
}

/** OCR d'un PDF scanné : rastérise puis OCR page par page */
export async function ocrPdfScanne(buffer: Buffer, maxPages = 10): Promise<string> {
  const images = await pdfVersImages(buffer, maxPages);
  if (!images.length) return '';
  let texte = '';
  for (let i = 0; i < images.length; i++) {
    const url = await imageVersDataUrl(images[i]);
    const t = await askVision(PROMPT_OCR, `Page ${i + 1}. Transcris ce document.`, [url]);
    texte += `\n--- Page ${i + 1} ---\n${t}`;
  }
  return texte;
}

/** Heuristique : un PDF est "scanné" si peu de texte extractible par page */
export function estPdfScanne(texte: string, nbPages: number): boolean {
  const parPage = texte.trim().length / Math.max(1, nbPages);
  return parPage < 80; // < 80 caractères/page => probablement scanné
}
