import ExcelJS from 'exceljs';

const ROUGE = 'FFC1272D';
const VERT = 'FF006233';

export async function genererBordereauChiffre(projet: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BTP Chiffrage IA Maroc';

  // --- Feuille Bordereau chiffré ---
  const ws = wb.addWorksheet('Bordereau chiffré');
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = `BORDEREAU DES PRIX CHIFFRÉ — ${projet.objet || ''}`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERT } };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;

  const header = ['N° Prix', 'Désignation', 'Unité', 'Quantité', 'P.U. HT (MAD)', 'Montant HT (MAD)', 'Déboursé sec', 'Marge'];
  const hr = ws.addRow(header);
  hr.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROUGE } };
    c.alignment = { horizontal: 'center', wrapText: true };
    c.border = { bottom: { style: 'thin' } };
  });

  let total = 0;
  (projet.articles || []).forEach((a: any) => {
    total += a.montantTotal || 0;
    const r = ws.addRow([
      a.numeroPrix, a.designation, a.unite, a.quantite,
      a.prixUnitaire, a.montantTotal, a.deboursesSec, a.marge,
    ]);
    [5, 6, 7, 8].forEach((i) => { r.getCell(i).numFmt = '# ##0.00'; });
  });

  const tr = ws.addRow(['', '', '', '', 'TOTAL HT', total, '', '']);
  tr.getCell(5).font = { bold: true };
  tr.getCell(6).font = { bold: true };
  tr.getCell(6).numFmt = '# ##0.00';
  const tva = ws.addRow(['', '', '', '', 'TVA 20%', total * 0.2, '', '']);
  tva.getCell(6).numFmt = '# ##0.00';
  const ttc = ws.addRow(['', '', '', '', 'TOTAL TTC', total * 1.2, '', '']);
  ttc.getCell(5).font = { bold: true };
  ttc.getCell(6).font = { bold: true };
  ttc.getCell(6).numFmt = '# ##0.00';

  ws.columns = [
    { width: 10 }, { width: 50 }, { width: 8 }, { width: 12 },
    { width: 15 }, { width: 18 }, { width: 15 }, { width: 12 },
  ];

  // --- Feuille Sous-détails ---
  const wsd = wb.addWorksheet('Sous-détails de prix');
  wsd.addRow(['N° Prix', 'Désignation', 'Fournitures', 'Main d\'œuvre', 'Matériel', 'Engins', 'Transport', 'Sous-traitance', 'Déboursé sec', 'Frais chantier', 'Frais généraux', 'Aléas', 'Prix revient', 'Marge', 'P.U. HT']);
  wsd.getRow(1).font = { bold: true };
  (projet.articles || []).forEach((a: any) => {
    wsd.addRow([
      a.numeroPrix, a.designation, a.prixFournitures, a.prixMainOeuvre, a.prixMateriel,
      a.prixEngins, a.prixTransport, a.prixSousTraitance, a.deboursesSec, a.fraisChantier,
      a.fraisGeneraux, a.aleas, a.prixRevient, a.marge, a.prixUnitaire,
    ]);
  });
  wsd.columns.forEach((c, i) => { c.width = i === 1 ? 45 : 13; });

  // --- Feuille Conditions du marché ---
  const wsc = wb.addWorksheet('Conditions du marché');
  const cond: [string, any][] = [
    ['Objet du marché', projet.objet],
    ['Maître d\'ouvrage', projet.maitreOuvrage],
    ['Maître d\'œuvre', projet.maitreOeuvre],
    ['Montant estimatif (MAD)', projet.montantEstimatif],
    ['Délai d\'exécution', projet.delaiExecution],
    ['Caution provisoire (MAD)', projet.cautionProvisoire],
    ['Caution définitive', projet.cautionDefinitive],
    ['Retenue de garantie', projet.retenueGarantie],
    ['Qualifications requises', projet.qualifications],
    ['Classifications requises', projet.classifications],
    ['Pénalités de retard', projet.penalitesRetard],
    ['Révision des prix', projet.revisionPrix],
    ['Modalités de paiement', projet.modalitesPaiement],
  ];
  cond.forEach(([k, v]) => {
    const r = wsc.addRow([k, v ?? '—']);
    r.getCell(1).font = { bold: true };
  });
  wsc.columns = [{ width: 30 }, { width: 70 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
