import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { genererBordereauChiffre } from '@/lib/exports/excel';
import { genererRapportPDF } from '@/lib/exports/pdf';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'excel';

  const projet = await prisma.projet.findFirst({
    where: { id: params.id, userId: (session.user as any).id },
    include: { articles: { orderBy: { numeroPrix: 'asc' } }, alertes: true, risques: true },
  });
  if (!projet) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const safe = (projet.objet || 'projet').replace(/[^a-z0-9]/gi, '_').slice(0, 40);

  if (format === 'pdf') {
    const buf = await genererRapportPDF(projet);
    return new NextResponse(buf as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport_${safe}.pdf"`,
      },
    });
  }

  const buf = await genererBordereauChiffre(projet);
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bordereau_${safe}.xlsx"`,
    },
  });
}
