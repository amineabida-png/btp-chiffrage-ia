import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extraireTexte, detecterTypeDocument } from '@/lib/document-parser';
import { analyserMetre } from '@/lib/metre';

export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const form = await req.formData();
  const projetId = form.get('projetId') as string;
  const files = form.getAll('files') as File[];
  if (!projetId || !files.length) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });

  const resultats = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const texte = await extraireTexte(buffer, file.type, file.name);
    const type = detecterTypeDocument(file.name, texte);

    const doc = await prisma.document.create({
      data: {
        nom: file.name, type: type as any,
        mimeType: file.type || 'application/octet-stream',
        taille: buffer.length, texteExtrait: texte.slice(0, 200000), projetId,
      },
    });

    // MÉTRÉ automatique des plans (DXF géométrie réelle, PDF/image lecture IA)
    if (type === 'PLAN' && process.env.GROQ_API_KEY) {
      try {
        const { lignes, resume, avertissement } = await analyserMetre(buffer, file.type, file.name);
        for (const l of lignes) {
          await prisma.metrePlan.create({
            data: {
              poste: l.poste, element: l.element, localisation: l.localisation || null,
              unite: l.unite, quantiteDetectee: l.quantite, modeCalcul: l.modeCalcul || null,
              observations: l.observations || null, source: l.source || file.name, projetId,
            },
          });
        }
        const prefix = avertissement ? `[⚠️ ${avertissement}]\n` : (resume ? `[MÉTRÉ] ${resume}\n` : '');
        if (prefix) await prisma.document.update({ where: { id: doc.id }, data: { texteExtrait: (prefix + texte).slice(0, 200000) } });
        if (avertissement) {
          await prisma.alerte.create({ data: { type: 'PLAN_NON_LISIBLE', message: avertissement, gravite: 'MOYEN', projetId } });
        }
      } catch { /* non bloquant */ }
    }

    resultats.push({ id: doc.id, nom: doc.nom, type: doc.type, taille: doc.taille });
  }
  return NextResponse.json({ ok: true, documents: resultats });
}
