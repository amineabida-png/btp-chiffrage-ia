import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const projet = await prisma.projet.findFirst({
    where: { id: params.id, userId: (session.user as any).id },
    include: {
      documents: true,
      articles: { orderBy: { numeroPrix: 'asc' } },
      alertes: true,
      risques: true,
      metres: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!projet) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(projet);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await req.json();
  const projet = await prisma.projet.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(projet);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  await prisma.projet.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
