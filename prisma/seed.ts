import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const mdpAdmin = await bcrypt.hash('Admin2026!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@btp-maroc.ma' },
    update: {},
    create: { email: 'admin@btp-maroc.ma', nom: 'Administrateur', motDePasse: mdpAdmin, role: 'ADMIN', entreprise: 'Entreprise BTP Maroc' },
  });

  const mdpMetreur = await bcrypt.hash('Metreur2026!', 10);
  await prisma.user.upsert({
    where: { email: 'metreur@btp-maroc.ma' },
    update: {},
    create: { email: 'metreur@btp-maroc.ma', nom: 'Métreur Démo', motDePasse: mdpMetreur, role: 'METREUR', entreprise: 'Entreprise BTP Maroc' },
  });

  console.log('✅ Comptes de démonstration prêts (admin@btp-maroc.ma / Admin2026!)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
