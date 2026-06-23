import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  nom: z.string().min(2),
  email: z.string().email(),
  motDePasse: z.string().min(6),
  entreprise: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const existe = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existe) return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 400 });
    const hash = await bcrypt.hash(data.motDePasse, 10);
    await prisma.user.create({
      data: { nom: data.nom, email: data.email.toLowerCase(), motDePasse: hash, entreprise: data.entreprise, role: 'CHARGE_ETUDE' },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 400 });
  }
}
