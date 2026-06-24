import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const projet = await prisma.projet.findUnique({
    where: { id: params.id },
    include: { metres: { orderBy: [{ poste: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!projet) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });

  const rows: any[][] = [['Poste', 'Ouvrage', 'Localisation', 'Unité', 'Quantité', 'Mode de calcul', 'Observations', 'Source']];
  let posteCourant = '';
  for (const m of projet.metres) {
    if (m.poste !== posteCourant) { posteCourant = m.poste; }
    rows.push([m.poste, m.element, m.localisation || '', m.unite, m.quantiteDetectee, m.modeCalcul || '', m.observations || '', m.source || '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 22 }, { wch: 48 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 30 }, { wch: 26 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Métré');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const nom = `Metre_${(projet.objet || 'projet').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nom}"`,
    },
  });
}
