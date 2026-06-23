import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Base de prix BTP Maroc — valeurs indicatives 2026 (MAD HT)
const prix = [
  // BATIMENT
  ['BATIMENT', 'Béton de propreté dosé à 250 kg/m³', 'M3', 950],
  ['BATIMENT', 'Béton armé pour fondations dosé à 350 kg/m³', 'M3', 1450],
  ['BATIMENT', 'Béton armé pour superstructure dosé à 350 kg/m³', 'M3', 1650],
  ['BATIMENT', "Acier pour béton armé (façonné et posé)", 'KG', 16],
  ['BATIMENT', 'Maçonnerie en agglos creux ep. 20 cm', 'M2', 165],
  ['BATIMENT', 'Maçonnerie en agglos creux ep. 10 cm (cloison)', 'M2', 110],
  ['BATIMENT', 'Enduit intérieur en mortier de ciment', 'M2', 75],
  ['BATIMENT', 'Enduit extérieur tyrolien', 'M2', 95],
  ['BATIMENT', 'Carrelage grès cérame 60x60 (fourniture et pose)', 'M2', 280],
  ['BATIMENT', 'Peinture vinylique sur murs intérieurs', 'M2', 55],
  ['BATIMENT', 'Étanchéité multicouche autoprotégée', 'M2', 220],
  ['BATIMENT', 'Faux plafond en plâtre BA13', 'M2', 130],
  // VRD
  ['VRD', 'Déblais en terrain de toute nature', 'M3', 45],
  ['VRD', 'Remblais en matériaux d\'apport compactés', 'M3', 75],
  ['VRD', 'Couche de fondation en GNF 0/31.5 ep. 20cm', 'M2', 65],
  ['VRD', 'Couche de base en GNB 0/20 ep. 15cm', 'M2', 75],
  ['VRD', 'Bordure de trottoir type T2 (F&P)', 'ML', 145],
  ['VRD', 'Pavé autobloquant ep. 8 cm (F&P)', 'M2', 175],
  // ASSAINISSEMENT
  ['ASSAINISSEMENT', 'Conduite PVC CR8 DN315 (F&P)', 'ML', 420],
  ['ASSAINISSEMENT', 'Conduite béton armé Ø600 (F&P)', 'ML', 950],
  ['ASSAINISSEMENT', 'Regard de visite préfabriqué Ø1000', 'U', 4500],
  ['ASSAINISSEMENT', 'Bouche d\'égout avaloir', 'U', 1800],
  // AEP
  ['AEP', 'Conduite PEHD PN16 DN110 (F&P)', 'ML', 230],
  ['AEP', 'Conduite fonte ductile DN200 (F&P)', 'ML', 680],
  ['AEP', 'Vanne opercule DN100 (F&P)', 'U', 2200],
  ['AEP', 'Poteau d\'incendie DN100', 'U', 8500],
  // ELECTRICITE
  ['ELECTRICITE', 'Câble U1000 R2V 4x25mm² (F&P)', 'ML', 95],
  ['ELECTRICITE', 'Tableau divisionnaire équipé', 'U', 6500],
  ['ELECTRICITE', 'Point lumineux complet', 'U', 450],
  // ECLAIRAGE
  ['ECLAIRAGE', 'Candélabre H=8m avec lanterne LED 80W', 'U', 7800],
  ['ECLAIRAGE', 'Câble souterrain U1000 RO2V 4x16mm²', 'ML', 78],
  ['ECLAIRAGE', 'Massif de fondation béton pour candélabre', 'U', 1200],
  // GENIE CIVIL
  ['GENIE_CIVIL', 'Béton B30 pour ouvrage d\'art', 'M3', 1850],
  ['GENIE_CIVIL', 'Coffrage soigné pour ouvrage', 'M2', 280],
  ['GENIE_CIVIL', 'Acier HA pour génie civil', 'KG', 17],
  // ROUTES
  ['ROUTES', 'Enrobé bitumineux EB 0/14 ep. 6cm', 'M2', 145],
  ['ROUTES', 'Imprégnation à l\'émulsion de bitume', 'M2', 18],
  ['ROUTES', 'Grave bitume GB 0/20 ep. 8cm', 'M2', 165],
  ['ROUTES', 'Signalisation horizontale (bande)', 'ML', 22],
  // ESPACES VERTS
  ['ESPACES_VERTS', 'Plantation d\'arbre tige (F&P)', 'U', 650],
  ['ESPACES_VERTS', 'Engazonnement (fourniture et mise en œuvre)', 'M2', 65],
  ['ESPACES_VERTS', 'Réseau d\'arrosage goutte-à-goutte', 'ML', 45],
  // HYDRAULIQUE
  ['HYDRAULIQUE', 'Béton pour seuil/déversoir', 'M3', 1750],
  ['HYDRAULIQUE', 'Gabion 1x1x2 m rempli', 'M3', 850],
  ['HYDRAULIQUE', 'Enrochement de protection', 'M3', 320],
];

async function main() {
  console.log('🌱 Initialisation de la base de données...');

  // Comptes par défaut
  const motDePasse = await bcrypt.hash('Admin2026!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@btp-maroc.ma' },
    update: {},
    create: {
      email: 'admin@btp-maroc.ma',
      nom: 'Administrateur',
      motDePasse,
      role: Role.ADMIN,
      entreprise: 'Entreprise BTP Maroc',
    },
  });

  const mdpMetreur = await bcrypt.hash('Metreur2026!', 10);
  await prisma.user.upsert({
    where: { email: 'metreur@btp-maroc.ma' },
    update: {},
    create: {
      email: 'metreur@btp-maroc.ma',
      nom: 'Métreur Démo',
      motDePasse: mdpMetreur,
      role: Role.METREUR,
      entreprise: 'Entreprise BTP Maroc',
    },
  });

  // Base de prix
  const count = await prisma.prixReference.count();
  if (count === 0) {
    for (const [corpsEtat, designation, unite, prixUnitaire] of prix) {
      await prisma.prixReference.create({
        data: {
          corpsEtat: corpsEtat as string,
          designation: designation as string,
          unite: unite as string,
          prixUnitaire: prixUnitaire as number,
          source: 'Base initiale 2026',
          annee: 2026,
        },
      });
    }
    console.log(`✅ ${prix.length} prix de référence importés`);
  }

  console.log('✅ Terminé. Compte admin: admin@btp-maroc.ma / Admin2026!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
