import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

// Normalise un en-tête de colonne (minuscule, sans accent)
function norm(s: string) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

// Convertit "1.500,00" ou "1 500,00" ou "1500.5" -> 1500.5
function toNumber(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim().replace(/dh|mad/gi, '').trim();
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); // 1.500,00
  else if (s.includes(',')) s = s.replace(/\s/g, '').replace(',', '.');                // 1500,00
  else s = s.replace(/\s/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function pick(row: Record<string, any>, keys: string[]) {
  for (const k of Object.keys(row)) { if (keys.includes(norm(k))) return row[k]; }
  return undefined;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });

    const source = (fd.get('source') as string)?.trim() || file.name.replace(/\.[^.]+$/, '');
    const annee = Number(fd.get('annee')) || new Date().getFullYear();
    const corpsDefaut = ((fd.get('corpsEtat') as string) || 'AUTRE').trim() || 'AUTRE';

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });

    const aInserer: any[] = [];
    let lignesLues = 0, ignorees = 0;
    const vusFichier = new Set<string>();

    for (const sheetName of wb.SheetNames) {
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      for (const row of rows) {
        lignesLues++;
        const designation = String(pick(row, ['designation', 'designationdesouvrages', 'libelle', 'ouvrage', 'description']) || '').trim();
        const prix = toNumber(pick(row, ['prixunitaireht', 'prixunitairehtmad', 'prixunitaire', 'prixht', 'prix', 'pu', 'puht', 'prixunitaireendhht']));
        if (!designation || prix == null || prix <= 0) { ignorees++; continue; }
        const unite = String(pick(row, ['unite', 'u', 'unit']) || 'U').trim().toUpperCase() || 'U';
        let corpsEtat = String(pick(row, ['corpsdetat', 'corpsetat', 'corps', 'lot']) || corpsDefaut).trim();
        if (!corpsEtat) corpsEtat = corpsDefaut;

        const cle = `${corpsEtat}|${designation.toLowerCase()}|${unite}|${prix}`;
        if (vusFichier.has(cle)) { ignorees++; continue; }
        vusFichier.add(cle);
        aInserer.push({ corpsEtat, designation, unite, prixUnitaire: prix, source, region: 'National', annee });
      }
    }

    if (!aInserer.length) {
      return NextResponse.json({ ok: false, error: 'Aucune ligne valide trouvée. Vérifiez les colonnes : Désignation, Unité, Prix.', lignesLues });
    }

    // Anti-doublon vs base existante (même désignation + unité + prix)
    const existantes = await prisma.prixReference.findMany({
      where: { designation: { in: aInserer.map((a) => a.designation).slice(0, 5000) } },
      select: { designation: true, unite: true, prixUnitaire: true },
    });
    const setExist = new Set(existantes.map((e: any) => `${e.designation.toLowerCase()}|${e.unite}|${e.prixUnitaire}`));
    const finales = aInserer.filter((a) => !setExist.has(`${a.designation.toLowerCase()}|${a.unite}|${a.prixUnitaire}`));

    let inseres = 0;
    for (let i = 0; i < finales.length; i += 500) {
      const lot = finales.slice(i, i + 500);
      await prisma.prixReference.createMany({ data: lot });
      inseres += lot.length;
    }

    const total = await prisma.prixReference.count();
    return NextResponse.json({
      ok: true,
      message: `Import terminé ✅`,
      source, inseres, doublonsIgnores: aInserer.length - finales.length, lignesIgnorees: ignorees, lignesLues, totalBibliotheque: total,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Erreur import' }, { status: 500 });
  }
}
