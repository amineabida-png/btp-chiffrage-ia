import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  // Vérifier que le document appartient à un projet de l'utilisateur
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { projet: { select: { userId: true, id: true } } },
  });
  if (!doc || doc.projet.userId !== (session.user as any).id) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  // Supprimer les métrés issus de ce plan (même source) puis le document
  await prisma.metrePlan.deleteMany({ where: { projetId: doc.projet.id, source: doc.nom } }).catch(() => {});
  await prisma.document.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
