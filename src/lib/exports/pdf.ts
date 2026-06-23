import PDFDocument from 'pdfkit';

function mad(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n || 0) + ' MAD';
}

export function genererRapportPDF(projet: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // En-tête
    doc.rect(0, 0, doc.page.width, 90).fill('#006233');
    doc.fillColor('#FFFFFF').fontSize(20).text('DOSSIER D\'ÉTUDE DE PRIX', 50, 30);
    doc.fontSize(11).text('BTP Chiffrage IA — Maroc', 50, 58);
    doc.moveDown(3);
    doc.fillColor('#000000');

    // Fiche synthèse
    doc.fontSize(16).fillColor('#C1272D').text('1. Fiche synthèse du marché', 50, 110);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000');
    const ligne = (k: string, v: any) => {
      doc.font('Helvetica-Bold').text(`${k} : `, { continued: true });
      doc.font('Helvetica').text(`${v ?? '—'}`);
    };
    ligne('Objet', projet.objet);
    ligne('Maître d\'ouvrage', projet.maitreOuvrage);
    ligne('Maître d\'œuvre', projet.maitreOeuvre);
    ligne('Montant estimatif', projet.montantEstimatif ? mad(projet.montantEstimatif) : '—');
    ligne('Délai d\'exécution', projet.delaiExecution);
    ligne('Caution provisoire', projet.cautionProvisoire ? mad(projet.cautionProvisoire) : '—');
    ligne('Caution définitive', projet.cautionDefinitive);
    ligne('Retenue de garantie', projet.retenueGarantie);
    ligne('Qualifications', projet.qualifications);
    ligne('Classifications', projet.classifications);
    ligne('Pénalités de retard', projet.penalitesRetard);
    ligne('Révision des prix', projet.revisionPrix);

    // Score de risque
    doc.moveDown(1);
    doc.fontSize(16).fillColor('#C1272D').text('2. Analyse des risques');
    doc.moveDown(0.3);
    const score = projet.scoreRisque ?? 0;
    const couleur = score >= 70 ? '#C1272D' : score >= 40 ? '#E8A100' : '#006233';
    doc.fontSize(12).fillColor(couleur).text(`Score de risque global : ${score}/100`);
    doc.fillColor('#000000').fontSize(10).moveDown(0.5);
    (projet.risques || []).forEach((r: any) => {
      doc.font('Helvetica-Bold').text(`[${r.niveau}] ${r.categorie} : `, { continued: true });
      doc.font('Helvetica').text(r.description);
      if (r.recommandation) doc.fillColor('#555555').text(`   → ${r.recommandation}`).fillColor('#000000');
      doc.moveDown(0.2);
    });

    // Alertes de cohérence
    if (projet.alertes?.length) {
      doc.moveDown(0.8);
      doc.fontSize(16).fillColor('#C1272D').text('3. Alertes de cohérence');
      doc.fontSize(10).fillColor('#000000').moveDown(0.3);
      projet.alertes.forEach((a: any) => {
        doc.font('Helvetica-Bold').text(`• [${a.gravite}] ${a.type} : `, { continued: true });
        doc.font('Helvetica').text(a.message);
      });
    }

    // Récapitulatif chiffrage
    const total = (projet.articles || []).reduce((s: number, a: any) => s + (a.montantTotal || 0), 0);
    if (total > 0) {
      doc.moveDown(0.8);
      doc.fontSize(16).fillColor('#C1272D').text('4. Récapitulatif du chiffrage');
      doc.fontSize(11).fillColor('#000000').moveDown(0.3);
      ligne('Nombre d\'articles', (projet.articles || []).length);
      ligne('Montant total HT', mad(total));
      ligne('TVA 20%', mad(total * 0.2));
      doc.font('Helvetica-Bold').fontSize(13).text(`Montant total TTC : ${mad(total * 1.2)}`);
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888888').text(
      `Document généré le ${new Date().toLocaleDateString('fr-MA')} par BTP Chiffrage IA. Estimations indicatives à valider par un métreur.`,
      50, doc.page.height - 60, { width: doc.page.width - 100, align: 'center' }
    );

    doc.end();
  });
}
