import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prixSimilaires } from '@/lib/learning';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const res = await prixSimilaires(q, 12);
  return NextResponse.json(res);
}
