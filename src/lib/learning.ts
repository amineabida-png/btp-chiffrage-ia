// Recherche sémantique (embeddings) + apprentissage continu de la base de prix
import { prisma } from './prisma';
import { embed, cosinus } from './embeddings';

export interface PrixSimilaire { id: string; designation: string; unite: string; prixUnitaire: number; score: number }

/** Remplit opportunément les embeddings manquants (par lots), pour que la base devienne sémantique sans étape manuelle */
async function backfillEmbeddings(limite = 25) {
  const sansEmbedding = await prisma.prixReference.findMany({
    where: { embedding: { isEmpty: true } },
    take: limite,
    select: { id: true, designation: true },
  });
  for (const row of sansEmbedding) {
    const v = await embed(row.designation);
    if (v.length) await prisma.prixReference.update({ where: { id: row.id }, data: { embedding: v } }).catch(() => {});
  }
}

/** Recherche les prix les plus proches sémantiquement d'une désignation */
export async function prixSimilaires(designation: string, limite = 8): Promise<PrixSimilaire[]> {
  if (!designation?.trim()) return [];

  // 1) Recherche VECTORIELLE (embeddings)
  try {
    await backfillEmbeddings(25);
    const qv = await embed(designation);
    if (qv.length) {
      const rows = await prisma.prixReference.findMany({
        where: { embedding: { isEmpty: false } },
        select: { id: true, designation: true, unite: true, prixUnitaire: true, embedding: true },
        take: 5000,
      });
      const notes = rows
        .map((r: any) => ({ ...r, score: cosinus(qv, r.embedding) }))
        .filter((r: any) => r.score > 0.45)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limite);
      if (notes.length) return notes.map((r: any) => ({ id: r.id, designation: r.designation, unite: r.unite, prixUnitaire: r.prixUnitaire, score: Math.round(r.score * 100) / 100 }));
    }
  } catch { /* repli */ }

  // 2) Repli SIMILARITÉ TEXTUELLE (pg_trgm)
  try {
    const rows = await prisma.$queryRaw<PrixSimilaire[]>`
      SELECT id, designation, unite, "prixUnitaire", similarity(designation, ${designation}) AS score
      FROM "PrixReference"
      WHERE similarity(designation, ${designation}) > 0.15
      ORDER BY score DESC LIMIT ${limite};`;
    if (rows.length) return rows;
  } catch { /* repli */ }

  // 3) Repli MOTS-CLÉS
  const mots = designation.toLowerCase().split(/\s+/).filter((m) => m.length > 3).slice(0, 3);
  if (!mots.length) return [];
  const r = await prisma.prixReference.findMany({
    where: { OR: mots.map((m) => ({ designation: { contains: m, mode: 'insensitive' as const } })) },
    take: limite,
  });
  return r.map((p: any) => ({ id: p.id, designation: p.designation, unite: p.unite, prixUnitaire: p.prixUnitaire, score: 0.5 }));
}

/** Enrichit la base avec les articles chiffrés + calcule leur embedding (apprentissage continu) */
export async function apprendrePrix(articles: { designation: string; unite: string; prixUnitaire: number }[], source: string, corpsEtat = 'AUTRE') {
  for (const a of articles) {
    if (!a.prixUnitaire || a.prixUnitaire <= 0) continue;
    const existe = await prixSimilaires(a.designation, 1);
    if (existe.length && existe[0].score > 0.9 && Math.abs(existe[0].prixUnitaire - a.prixUnitaire) / a.prixUnitaire < 0.05) continue;
    const v = await embed(a.designation).catch(() => [] as number[]);
    await prisma.prixReference.create({
      data: { corpsEtat, designation: a.designation, unite: a.unite, prixUnitaire: a.prixUnitaire, source, annee: new Date().getFullYear(), embedding: v },
    }).catch(() => {});
  }
}
