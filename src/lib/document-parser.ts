// Extraction de texte : PDF (natif + OCR), Word, Excel, images (OCR vision)
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { ocrImage, ocrPdfScanne, estPdfScanne } from './ocr';

export async function extraireTexte(buffer: Buffer, mimeType: string, nom: string): Promise<string> {
  const ext = nom.split('.').pop()?.toLowerCase() || '';

  // PDF (texte natif, sinon OCR du scan)
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    let texte = ''; let nbPages = 1;
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      texte = data.text || ''; nbPages = data.numpages || 1;
    } catch { /* on tentera l'OCR */ }

    if (texte.trim() && !estPdfScanne(texte, nbPages)) return texte;

    // PDF scanné -> OCR vision
    try {
      const ocr = await ocrPdfScanne(buffer, 10);
      return ocr.trim() || texte || '[PDF scanné : aucun texte reconnu.]';
    } catch (e) {
      return texte || `[PDF scanné non traité (OCR indisponible: ${(e as Error).message}).]`;
    }
  }

  // Word
  if (ext === 'docx' || mimeType.includes('word') || mimeType.includes('officedocument.wordprocessing')) {
    try { return (await mammoth.extractRawText({ buffer })).value || ''; }
    catch (e) { return `[Extraction Word impossible: ${(e as Error).message}]`; }
  }

  // Excel / CSV
  if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    try {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      return wb.SheetNames.map((n) => `\n=== Feuille: ${n} ===\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
    } catch (e) { return `[Extraction Excel impossible: ${(e as Error).message}]`; }
  }

  // Images -> OCR vision Groq
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    try { return await ocrImage(buffer); }
    catch (e) { return `[OCR image impossible: ${(e as Error).message}]`; }
  }

  try { return buffer.toString('utf-8'); } catch { return ''; }
}

export function detecterTypeDocument(nom: string, texte: string): string {
  const n = nom.toLowerCase(); const t = texte.toLowerCase().slice(0, 5000);
  if (n.includes('bpu') || n.includes('bordereau')) return 'BPU';
  if (n.includes('dqe') || n.includes('estimatif') || n.includes('quantitatif')) return 'DQE';
  if (n.includes('cps')) return 'CPS';
  if (n.includes('cctp')) return 'CCTP';
  if (n.includes('rc') || n.includes('reglement') || n.includes('règlement')) return 'RC';
  if (n.includes('plan')) return 'PLAN';
  if (t.includes('bordereau des prix')) return 'BPU';
  if (t.includes('détail estimatif') || t.includes('detail estimatif')) return 'DQE';
  if (t.includes('prescriptions spéciales')) return 'CPS';
  if (t.includes('règlement de consultation')) return 'RC';
  return 'AUTRE';
}
