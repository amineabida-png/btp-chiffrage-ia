import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const corps = searchParams.get('corpsEtat');
  const q = searchParams.get('q');
  const prix = await prisma.prixReference.findMany({
    where: {
      ...(corps ? { corpsEtat: corps } : {}),
      ...(q ? { designation: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return NextResponse.json(prix);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await req.json();
  const prix = await prisma.prixReference.create({
    data: {
      corpsEtat: body.corpsEtat, designation: body.designation, unite: body.unite,
      prixUnitaire: Number(body.prixUnitaire), region: body.region || 'National', annee: Number(body.annee) || new Date().getFullYear(),
    },
  });
  return NextResponse.json(prix);
}
