import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialise les comptes de démonstration (métré). Idempotent.
export async function GET() {
  try {
    const existeAdmin = await prisma.user.findUnique({ where: { email: 'admin@btp-maroc.ma' } });
    if (existeAdmin) {
      return NextResponse.json({ ok: true, message: 'Déjà initialisé. Connectez-vous avec admin@btp-maroc.ma / Admin2026!' });
    }
    const mdpAdmin = await bcrypt.hash('Admin2026!', 10);
    await prisma.user.create({
      data: { email: 'admin@btp-maroc.ma', nom: 'Administrateur', motDePasse: mdpAdmin, role: 'ADMIN', entreprise: 'Entreprise BTP Maroc' },
    });
    const mdpMetreur = await bcrypt.hash('Metreur2026!', 10);
    await prisma.user.create({
      data: { email: 'metreur@btp-maroc.ma', nom: 'Métreur Démo', motDePasse: mdpMetreur, role: 'METREUR', entreprise: 'Entreprise BTP Maroc' },
    });
    return NextResponse.json({
      ok: true,
      message: 'Initialisation terminée ✅',
      comptes: { admin: 'admin@btp-maroc.ma / Admin2026!', metreur: 'metreur@btp-maroc.ma / Metreur2026!' },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
