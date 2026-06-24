import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyserMarche, extraireArticlesGros, chiffrerArticle, analyserRisques } from '@/lib/ai';
import { calculerPrix, COEFFICIENTS_DEFAUT } from '@/lib/pricing';
import { prixSimilaires, apprendrePrix } from '@/lib/learning';
import { construireMatcher, trouverPrix } from '@/lib/matching';
import { comparerPlanDQE } from '@/lib/plans';

export const maxDuration = 300;

// Convertit une valeur IA (liste, objet, nombre...) en texte propre ou null
function S(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) return v.filter(Boolean).map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ; ') || null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
// Convertit en nombre ou null
function N(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

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
    const articlesBruts = await extraireArticlesGros(texteComplet);
    await prisma.article.deleteMany({ where: { projetId: projet.id } });

    // 3. Chiffrage depuis la BIBLIOTHÈQUE UNIQUEMENT (traçable). L'IA n'invente aucun prix.
    //    Moteur de correspondance lexical TF-IDF (fiable, sans dépendre des embeddings).
    const SEUIL = Number(process.env.PRICE_MATCH_THRESHOLD || 0.42);
    const refs = await prisma.prixReference.findMany({ select: { designation: true, unite: true, prixUnitaire: true }, take: 50000 });
    const matcher = construireMatcher(refs);
    let sansPrix = 0;
    for (const art of articlesBruts) {
      const designation = String(art.designation || '');
      const unite = String(art.unite || 'U');
      const quantite = Number(art.quantite) || 0;

      const match = trouverPrix(designation, unite, matcher, SEUIL);
      let prixUnitaire = 0; let sourcePrix: string | null = null;
      if (match) { prixUnitaire = match.prixUnitaire; sourcePrix = `${match.designation} (${Math.round(match.score * 100)}%)`; }
      else sansPrix++;

      await prisma.article.create({
        data: {
          numeroPrix: String(art.numeroPrix || ''), designation, unite, quantite,
          observations: S(art.observations),
          prixFournitures: 0, prixMainOeuvre: 0, prixMateriel: 0, prixEngins: 0, prixTransport: 0, prixSousTraitance: 0,
          deboursesSec: 0, fraisChantier: 0, fraisGeneraux: 0, aleas: 0, marge: 0,
          prixRevient: prixUnitaire, prixUnitaire,
          montantTotal: Math.round(prixUnitaire * quantite * 100) / 100,
          sourceIA: false, sourcePrix, projetId: projet.id,
        },
      });
    }
    const aChiffrer = articlesBruts;

    // 4. Risques + alertes
    let risquesData: any = { scoreRisque: 0, risques: [], alertes: [] };
    try { risquesData = await analyserRisques(texteComplet, articlesBruts); } catch {}
    await prisma.alerte.deleteMany({ where: { projetId: projet.id } });
    await prisma.risque.deleteMany({ where: { projetId: projet.id } });
    for (const a of risquesData.alertes || [])
      await prisma.alerte.create({ data: { type: a.type || 'INCOHERENCE', message: a.message || '', gravite: a.gravite || 'MOYEN', projetId: projet.id } });
    for (const r of risquesData.risques || [])
      await prisma.risque.create({ data: { categorie: r.categorie || 'TECHNIQUE', description: r.description || '', niveau: r.niveau || 'MOYEN', recommandation: r.recommandation || null, projetId: projet.id } });

    // Alerte: articles sans prix en base (à chiffrer manuellement)
    if (sansPrix > 0) {
      await prisma.alerte.create({
        data: {
          type: 'A_CHIFFRER',
          message: `${sansPrix} article(s) sans correspondance fiable dans la bibliothèque de prix : à chiffrer manuellement (prix = 0). Enrichissez la bibliothèque pour les retrouver automatiquement.`,
          gravite: sansPrix > articlesBruts.length / 2 ? 'ELEVE' : 'MOYEN',
          projetId: projet.id,
        },
      });
    }

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
        objet: S(fiche.objet) || projet.objet, maitreOuvrage: S(fiche.maitreOuvrage),
        maitreOeuvre: S(fiche.maitreOeuvre), montantEstimatif: N(fiche.montantEstimatif),
        delaiExecution: S(fiche.delaiExecution), lieuExecution: S(fiche.lieuExecution),
        cautionProvisoire: N(fiche.cautionProvisoire), cautionDefinitive: S(fiche.cautionDefinitive),
        retenueGarantie: S(fiche.retenueGarantie), qualifications: S(fiche.qualifications),
        classifications: S(fiche.classifications), penalitesRetard: S(fiche.penalitesRetard),
        modalitesPaiement: S(fiche.modalitesPaiement), revisionPrix: S(fiche.revisionPrix),
        ficheSynthese: fiche, scoreRisque: Number(risquesData.scoreRisque) || 0, statut: 'CHIFFRE',
      },
    });

    return NextResponse.json({ ok: true, articles: aChiffrer.length, sansPrix, scoreRisque: risquesData.scoreRisque, metres: projet.metres.length });
  } catch (e: any) {
    await prisma.projet.update({ where: { id: projet.id }, data: { statut: 'BROUILLON' } });
    return NextResponse.json({ error: 'Erreur analyse IA: ' + (e.message || '') }, { status: 500 });
  }
}
