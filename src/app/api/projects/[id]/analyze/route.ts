import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyserMarche, extraireArticles, chiffrerArticle, analyserRisques } from '@/lib/ai';
import { calculerPrix, COEFFICIENTS_DEFAUT } from '@/lib/pricing';
import { prixSimilaires, apprendrePrix } from '@/lib/learning';
import { comparerPlanDQE } from '@/lib/plans';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'Clé GROQ_API_KEY non configurée sur le serveur.' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const coeffs = { ...COEFFICIENTS_DEFAUT, ...(body.coefficients || {}) };

  const projet = await prisma.projet.findFirst({
    where: { id: params.id, userId: (session.user as any).id },
    include: { documents: true, metres: true },
  });
  if (!projet) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const texteComplet = projet.documents.map((d: any) => `\n=== ${d.nom} (${d.type}) ===\n${d.texteExtrait || ''}`).join('\n');
  if (!texteComplet.trim()) return NextResponse.json({ error: 'Aucun document à analyser.' }, { status: 400 });

  await prisma.projet.update({ where: { id: projet.id }, data: { statut: 'EN_ANALYSE' } });

  try {
    // 1. Fiche synthèse
    const fiche = await analyserMarche(texteComplet);

    // 2. Articles
    const articlesBruts = await extraireArticles(texteComplet);
    await prisma.article.deleteMany({ where: { projetId: projet.id } });

    // 3. Chiffrage IA (assisté par recherche de similarité dans la base)
    const aChiffrer = articlesBruts.slice(0, 40);
    for (const art of aChiffrer) {
      const similaires = await prixSimilaires(String(art.designation || ''), 8);
      let sd: any = { prixFournitures: 0, prixMainOeuvre: 0, prixMateriel: 0, prixEngins: 0, prixTransport: 0, prixSousTraitance: 0, sousDetail: null };
      try { sd = await chiffrerArticle({ designation: art.designation, unite: art.unite }, similaires); } catch {}

      const calc = calculerPrix({
        prixFournitures: sd.prixFournitures || 0, prixMainOeuvre: sd.prixMainOeuvre || 0,
        prixMateriel: sd.prixMateriel || 0, prixEngins: sd.prixEngins || 0,
        prixTransport: sd.prixTransport || 0, prixSousTraitance: sd.prixSousTraitance || 0,
      }, coeffs);

      const quantite = Number(art.quantite) || 0;
      await prisma.article.create({
        data: {
          numeroPrix: String(art.numeroPrix || ''), designation: String(art.designation || ''),
          unite: String(art.unite || 'U'), quantite, observations: art.observations || null,
          prixFournitures: sd.prixFournitures || 0, prixMainOeuvre: sd.prixMainOeuvre || 0,
          prixMateriel: sd.prixMateriel || 0, prixEngins: sd.prixEngins || 0,
          prixTransport: sd.prixTransport || 0, prixSousTraitance: sd.prixSousTraitance || 0,
          sousDetail: sd.sousDetail || undefined, ...calc,
          montantTotal: Math.round(calc.prixUnitaire * quantite * 100) / 100,
          sourceIA: true, projetId: projet.id,
        },
      });
    }

    // 4. Risques + alertes
    let risquesData: any = { scoreRisque: 0, risques: [], alertes: [] };
    try { risquesData = await analyserRisques(texteComplet, articlesBruts); } catch {}
    await prisma.alerte.deleteMany({ where: { projetId: projet.id } });
    await prisma.risque.deleteMany({ where: { projetId: projet.id } });
    for (const a of risquesData.alertes || [])
      await prisma.alerte.create({ data: { type: a.type || 'INCOHERENCE', message: a.message || '', gravite: a.gravite || 'MOYEN', projetId: projet.id } });
    for (const r of risquesData.risques || [])
      await prisma.risque.create({ data: { categorie: r.categorie || 'TECHNIQUE', description: r.description || '', niveau: r.niveau || 'MOYEN', recommandation: r.recommandation || null, projetId: projet.id } });

    // 5. Comparaison Plans (métré) vs DQE -> écarts
    if (projet.metres.length) {
      const comparaisons = comparerPlanDQE(
        projet.metres.map((m: any) => ({ element: m.element, unite: m.unite, quantite: m.quantiteDetectee })),
        aChiffrer.map((a: any) => ({ designation: String(a.designation || ''), unite: String(a.unite || ''), quantite: Number(a.quantite) || 0 }))
      );
      for (let i = 0; i < comparaisons.length; i++) {
        const c = comparaisons[i]; const m = projet.metres[i];
        await prisma.metrePlan.update({ where: { id: m.id }, data: { quantiteDQE: c.quantiteDQE, ecartPourcent: c.ecartPourcent } });
        if (c.ecartPourcent != null && Math.abs(c.ecartPourcent) >= 10) {
          await prisma.alerte.create({
            data: {
              type: 'INCOHERENCE',
              message: `Écart plan/DQE sur "${c.element}" : plan=${c.quantite} ${c.unite}, DQE=${c.quantiteDQE} ${c.unite} (${c.ecartPourcent > 0 ? '+' : ''}${c.ecartPourcent}%).`,
              gravite: Math.abs(c.ecartPourcent) >= 25 ? 'ELEVE' : 'MOYEN', projetId: projet.id,
            },
          });
        }
      }
    }

    // 6. Mise à jour fiche projet
    await prisma.projet.update({
      where: { id: projet.id },
      data: {
        objet: fiche.objet || projet.objet, maitreOuvrage: fiche.maitreOuvrage || null,
        maitreOeuvre: fiche.maitreOeuvre || null, montantEstimatif: fiche.montantEstimatif || null,
        delaiExecution: fiche.delaiExecution || null, lieuExecution: fiche.lieuExecution || null,
        cautionProvisoire: fiche.cautionProvisoire || null, cautionDefinitive: fiche.cautionDefinitive || null,
        retenueGarantie: fiche.retenueGarantie || null, qualifications: fiche.qualifications || null,
        classifications: fiche.classifications || null, penalitesRetard: fiche.penalitesRetard || null,
        modalitesPaiement: fiche.modalitesPaiement || null, revisionPrix: fiche.revisionPrix || null,
        ficheSynthese: fiche, scoreRisque: risquesData.scoreRisque || 0, statut: 'CHIFFRE',
      },
    });

    // 7. Apprentissage continu (enrichissement de la base de prix)
    const articlesCrees = await prisma.article.findMany({ where: { projetId: projet.id } });
    await apprendrePrix(
      articlesCrees.map((a: any) => ({ designation: a.designation, unite: a.unite, prixUnitaire: a.prixUnitaire })),
      projet.objet
    );

    return NextResponse.json({ ok: true, articles: aChiffrer.length, scoreRisque: risquesData.scoreRisque, metres: projet.metres.length });
  } catch (e: any) {
    await prisma.projet.update({ where: { id: projet.id }, data: { statut: 'BROUILLON' } });
    return NextResponse.json({ error: 'Erreur analyse IA: ' + (e.message || '') }, { status: 500 });
  }
}
