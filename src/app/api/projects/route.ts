import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const projets = await prisma.projet.findMany({
    where: { userId: (session.user as any).id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { articles: true, documents: true, alertes: true } } },
  });
  return NextResponse.json(projets);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await req.json();
  const projet = await prisma.projet.create({
    data: {
      objet: body.objet || 'Nouvel appel d\'offres',
      reference: body.reference || null,
      userId: (session.user as any).id,
    },
  });
  return NextResponse.json(projet);
}
