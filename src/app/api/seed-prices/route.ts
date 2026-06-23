import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Bibliothèque de prix BTP Maroc — indicatifs 2026 (MAD HT), ouvrages fournis & posés (F&P)
// Sources marché T2 2026 : enginloc.ma, lechantier.ma, archiplan.ma, CYPE Maroc.
const CATALOGUE: [string, string, string, number][] = [
  // ===== TERRASSEMENTS / TchOIX =====
  ['TERRASSEMENT', 'Décapage de la terre végétale ep. 20 cm', 'M2', 12],
  ['TERRASSEMENT', 'Fouilles en pleine masse en terrain ordinaire', 'M3', 38],
  ['TERRASSEMENT', 'Fouilles en rigole ou en tranchée', 'M3', 55],
  ['TERRASSEMENT', 'Remblai en provenance des fouilles compacté', 'M3', 45],
  ['TERRASSEMENT', "Remblai d'apport en tout-venant compacté", 'M3', 80],
  ['TERRASSEMENT', 'Évacuation des déblais excédentaires à la décharge', 'M3', 42],
  ['TERRASSEMENT', "Lit de sable pour pose de canalisation", 'M3', 180],
  // ===== GROS ŒUVRE / BÉTONS =====
  ['BATIMENT', 'Béton de propreté dosé à 150 kg/m³', 'M3', 850],
  ['BATIMENT', 'Béton B15 dosé à 250 kg/m³', 'M3', 950],
  ['BATIMENT', 'Béton B20 dosé à 300 kg/m³', 'M3', 1050],
  ['BATIMENT', 'Béton armé B25 dosé à 350 kg/m³ pour fondations', 'M3', 1450],
  ['BATIMENT', 'Béton armé B25 pour amorces de poteaux/longrines', 'M3', 1550],
  ['BATIMENT', 'Béton armé B30 pour superstructure (poteaux, poutres)', 'M3', 1650],
  ['BATIMENT', 'Béton armé B30 pour planchers/dalles pleines', 'M3', 1600],
  ['BATIMENT', 'Plancher à corps creux (16+4) y compris hourdis', 'M2', 320],
  ['BATIMENT', 'Plancher à corps creux (20+5)', 'M2', 360],
  ['BATIMENT', 'Dallage en béton armé ep. 12 cm sur hérisson', 'M2', 260],
  ['BATIMENT', 'Hérisson en pierre sèche ep. 20 cm', 'M2', 75],
  ['BATIMENT', 'Acier HA Fe E500 pour béton armé (façonné et posé)', 'KG', 16],
  ['BATIMENT', 'Acier doux Fe E235 (façonné et posé)', 'KG', 15],
  ['BATIMENT', 'Treillis soudé pour dallage', 'KG', 17],
  ['BATIMENT', 'Coffrage ordinaire pour fondations', 'M2', 110],
  ['BATIMENT', 'Coffrage soigné pour béton apparent', 'M2', 220],
  ['BATIMENT', 'Coffrage pour poteaux et poutres', 'M2', 170],
  // ===== MAÇONNERIE =====
  ['BATIMENT', 'Maçonnerie en agglos creux ep. 20 cm', 'M2', 165],
  ['BATIMENT', 'Maçonnerie en agglos creux ep. 15 cm', 'M2', 135],
  ['BATIMENT', 'Maçonnerie en agglos creux ep. 10 cm (cloison)', 'M2', 110],
  ['BATIMENT', 'Cloison en brique creuse 6 trous ep. 7 cm', 'M2', 95],
  ['BATIMENT', 'Double cloison en brique avec lame d\'air', 'M2', 220],
  ['BATIMENT', 'Maçonnerie en briques rouges pleines', 'M2', 185],
  ['BATIMENT', 'Mur en pierre maçonnée hourdée au mortier', 'M3', 950],
  // ===== ENDUITS =====
  ['BATIMENT', 'Enduit intérieur en mortier de ciment (sous-couche + finition)', 'M2', 75],
  ['BATIMENT', 'Enduit extérieur tyrolien projeté', 'M2', 95],
  ['BATIMENT', 'Enduit de façade gratté/taloché', 'M2', 110],
  ['BATIMENT', 'Chape de ciment lissée ep. 5 cm', 'M2', 85],
  ['BATIMENT', 'Forme de pente pour étanchéité', 'M2', 70],
  // ===== ÉTANCHÉITÉ =====
  ['BATIMENT', 'Étanchéité multicouche autoprotégée (terrasse)', 'M2', 220],
  ['BATIMENT', 'Étanchéité monocouche soudée + protection', 'M2', 180],
  ['BATIMENT', 'Étanchéité liquide (SEL) pour pièces humides', 'M2', 120],
  ['BATIMENT', 'Relevé d\'étanchéité y compris solin', 'ML', 130],
  // ===== REVÊTEMENTS SOLS & MURS =====
  ['BATIMENT', 'Carrelage grès cérame 60x60 (F&P)', 'M2', 280],
  ['BATIMENT', 'Carrelage grès cérame 30x30 antidérapant', 'M2', 190],
  ['BATIMENT', 'Faïence murale 25x40 (F&P)', 'M2', 170],
  ['BATIMENT', 'Revêtement en marbre poli (F&P)', 'M2', 550],
  ['BATIMENT', 'Plinthe en grès cérame', 'ML', 45],
  ['BATIMENT', 'Parquet stratifié flottant (F&P)', 'M2', 180],
  ['BATIMENT', 'Revêtement PVC/lino pour locaux techniques', 'M2', 140],
  // ===== FAUX PLAFONDS =====
  ['BATIMENT', 'Faux plafond en plaques de plâtre BA13', 'M2', 130],
  ['BATIMENT', 'Faux plafond démontable 60x60 (dalles minérales)', 'M2', 150],
  ['BATIMENT', 'Faux plafond hydrofuge pour locaux humides', 'M2', 165],
  ['BATIMENT', 'Habillage en staff / corniche', 'ML', 90],
  // ===== PEINTURE =====
  ['BATIMENT', 'Peinture vinylique sur murs intérieurs (2 couches)', 'M2', 55],
  ['BATIMENT', 'Peinture acrylique de façade (2 couches)', 'M2', 70],
  ['BATIMENT', 'Peinture glycéro/laquée sur menuiserie bois', 'M2', 95],
  ['BATIMENT', 'Peinture antirouille + finition sur métal', 'M2', 85],
  ['BATIMENT', 'Enduit de rebouchage et ratissage', 'M2', 35],
  // ===== MENUISERIE BOIS =====
  ['BATIMENT', 'Porte intérieure isoplane (huisserie + vantail)', 'U', 1500],
  ['BATIMENT', 'Porte palière blindée', 'U', 4500],
  ['BATIMENT', 'Placard mural en bois avec rayonnage', 'M2', 1200],
  // ===== MENUISERIE ALUMINIUM =====
  ['BATIMENT', 'Fenêtre coulissante en aluminium (F&P)', 'M2', 1100],
  ['BATIMENT', 'Châssis fixe alu + vitrage', 'M2', 950],
  ['BATIMENT', 'Porte d\'entrée en aluminium vitrée', 'U', 3500],
  ['BATIMENT', 'Mur rideau en aluminium', 'M2', 2200],
  // ===== MENUISERIE MÉTALLIQUE =====
  ['BATIMENT', 'Garde-corps métallique pour escalier', 'ML', 650],
  ['BATIMENT', 'Grille de protection métallique', 'M2', 550],
  ['BATIMENT', 'Portail métallique coulissant', 'M2', 1400],
  ['BATIMENT', 'Charpente métallique (fourniture, montage)', 'KG', 28],
  ['BATIMENT', 'Couverture en bac acier nervuré', 'M2', 220],
  // ===== PLOMBERIE / SANITAIRE =====
  ['BATIMENT', 'Alimentation EF/EC en PPR par point d\'eau', 'U', 850],
  ['BATIMENT', 'Évacuation EU/EV en PVC par appareil', 'U', 650],
  ['BATIMENT', 'WC à l\'anglaise complet (F&P)', 'U', 1800],
  ['BATIMENT', 'Lavabo sur colonne avec robinetterie', 'U', 1400],
  ['BATIMENT', 'Receveur de douche + robinetterie', 'U', 2200],
  ['BATIMENT', 'Chauffe-eau électrique 100 L (F&P)', 'U', 2500],
  ['BATIMENT', 'Poteau d\'incendie / RIA DN40', 'U', 4500],
  // ===== ÉLECTRICITÉ BÂTIMENT =====
  ['ELECTRICITE', 'Point lumineux simple allumage complet', 'U', 450],
  ['ELECTRICITE', 'Point lumineux va-et-vient', 'U', 550],
  ['ELECTRICITE', 'Prise de courant 2P+T 16A', 'U', 320],
  ['ELECTRICITE', 'Tableau électrique divisionnaire équipé', 'U', 6500],
  ['ELECTRICITE', 'Coffret de comptage et protection générale', 'U', 4500],
  ['ELECTRICITE', 'Câble U1000 R2V 3x2.5mm² (F&P)', 'ML', 35],
  ['ELECTRICITE', 'Câble U1000 R2V 4x25mm² (F&P)', 'ML', 95],
  ['ELECTRICITE', 'Mise à la terre + liaison équipotentielle', 'U', 2200],
  ['ELECTRICITE', 'Détecteur de mouvement / présence', 'U', 480],
  ['ELECTRICITE', 'Bloc autonome d\'éclairage de sécurité (BAES)', 'U', 650],
  // ===== CLIMATISATION / VMC =====
  ['BATIMENT', 'Climatiseur split mural 12000 BTU (F&P)', 'U', 6500],
  ['BATIMENT', 'Gaine de ventilation galvanisée', 'M2', 280],
  ['BATIMENT', 'Extracteur d\'air pour local humide', 'U', 850],
  // ===== VRD =====
  ['VRD', 'Déblais en terrain de toute nature (voirie)', 'M3', 45],
  ['VRD', 'Remblais en matériaux d\'apport compactés', 'M3', 75],
  ['VRD', 'Couche de forme en matériau sélectionné ep. 30cm', 'M2', 55],
  ['VRD', 'Couche de fondation en GNF 0/31.5 ep. 20cm', 'M2', 65],
  ['VRD', 'Couche de base en GNB 0/20 ep. 15cm', 'M2', 75],
  ['VRD', 'Bordure de trottoir type T2 (F&P)', 'ML', 145],
  ['VRD', 'Bordure type A2 / caniveau CS2', 'ML', 165],
  ['VRD', 'Pavé autobloquant ep. 8 cm (F&P)', 'M2', 175],
  ['VRD', 'Dalle podotactile pour PMR', 'ML', 220],
  ['VRD', 'Trottoir en béton désactivé', 'M2', 195],
  // ===== ROUTES =====
  ['ROUTES', 'Imprégnation à l\'émulsion de bitume', 'M2', 18],
  ['ROUTES', 'Couche d\'accrochage', 'M2', 12],
  ['ROUTES', 'Grave bitume GB 0/20 ep. 8cm', 'M2', 165],
  ['ROUTES', 'Enrobé bitumineux EB 0/10 ep. 5cm', 'M2', 125],
  ['ROUTES', 'Enrobé bitumineux EB 0/14 ep. 6cm', 'M2', 145],
  ['ROUTES', 'Enduit superficiel bicouche', 'M2', 45],
  ['ROUTES', 'Signalisation horizontale (bande continue)', 'ML', 22],
  ['ROUTES', 'Panneau de signalisation verticale', 'U', 1200],
  ['ROUTES', 'Glissière de sécurité métallique', 'ML', 450],
  // ===== ASSAINISSEMENT =====
  ['ASSAINISSEMENT', 'Conduite PVC CR8 DN200 (F&P)', 'ML', 280],
  ['ASSAINISSEMENT', 'Conduite PVC CR8 DN315 (F&P)', 'ML', 420],
  ['ASSAINISSEMENT', 'Conduite PVC CR8 DN400 (F&P)', 'ML', 620],
  ['ASSAINISSEMENT', 'Conduite béton armé Ø600 (F&P)', 'ML', 950],
  ['ASSAINISSEMENT', 'Conduite béton armé Ø800 (F&P)', 'ML', 1450],
  ['ASSAINISSEMENT', 'Regard de visite préfabriqué Ø1000', 'U', 4500],
  ['ASSAINISSEMENT', 'Regard borgne / de branchement 60x60', 'U', 1800],
  ['ASSAINISSEMENT', 'Bouche d\'égout avaloir avec grille fonte', 'U', 1800],
  ['ASSAINISSEMENT', 'Branchement particulier complet', 'U', 2500],
  ['ASSAINISSEMENT', 'Fosse septique toutes eaux (F&P)', 'U', 12000],
  // ===== AEP =====
  ['AEP', 'Conduite PEHD PN16 DN63 (F&P)', 'ML', 110],
  ['AEP', 'Conduite PEHD PN16 DN110 (F&P)', 'ML', 230],
  ['AEP', 'Conduite PEHD PN16 DN160 (F&P)', 'ML', 380],
  ['AEP', 'Conduite fonte ductile DN200 (F&P)', 'ML', 680],
  ['AEP', 'Vanne opercule DN100 + accessoires (F&P)', 'U', 2200],
  ['AEP', 'Ventouse / vidange sur conduite', 'U', 3500],
  ['AEP', 'Poteau d\'incendie DN100 normalisé', 'U', 8500],
  ['AEP', 'Regard pour compteur / vanne', 'U', 2200],
  // ===== ÉCLAIRAGE PUBLIC =====
  ['ECLAIRAGE', 'Candélabre H=8m + lanterne LED 80W (F&P)', 'U', 7800],
  ['ECLAIRAGE', 'Candélabre H=10m + lanterne LED 120W', 'U', 9500],
  ['ECLAIRAGE', 'Mât d\'éclairage décoratif', 'U', 6500],
  ['ECLAIRAGE', 'Câble souterrain U1000 RO2V 4x16mm²', 'ML', 78],
  ['ECLAIRAGE', 'Massif de fondation béton pour candélabre', 'U', 1200],
  ['ECLAIRAGE', 'Armoire de commande d\'éclairage public', 'U', 12000],
  ['ECLAIRAGE', 'Fourreau TPC Ø90 + grillage avertisseur', 'ML', 55],
  // ===== GÉNIE CIVIL =====
  ['GENIE_CIVIL', 'Béton B30 pour ouvrage d\'art', 'M3', 1850],
  ['GENIE_CIVIL', 'Béton B35 pour ouvrage hydraulique', 'M3', 2050],
  ['GENIE_CIVIL', 'Coffrage soigné pour ouvrage', 'M2', 280],
  ['GENIE_CIVIL', 'Acier HA pour génie civil', 'KG', 17],
  ['GENIE_CIVIL', 'Appareil d\'appui en élastomère fretté', 'U', 3500],
  ['GENIE_CIVIL', 'Joint de chaussée pour pont', 'ML', 4500],
  ['GENIE_CIVIL', 'Buse métallique / dalot préfabriqué', 'ML', 2800],
  // ===== ESPACES VERTS =====
  ['ESPACES_VERTS', 'Plantation d\'arbre tige (F&P)', 'U', 650],
  ['ESPACES_VERTS', 'Plantation d\'arbuste / haie', 'U', 85],
  ['ESPACES_VERTS', 'Engazonnement (fourniture et mise en œuvre)', 'M2', 65],
  ['ESPACES_VERTS', 'Terre végétale rapportée', 'M3', 180],
  ['ESPACES_VERTS', 'Réseau d\'arrosage goutte-à-goutte', 'ML', 45],
  ['ESPACES_VERTS', 'Arrosage automatique par aspersion (tête)', 'U', 350],
  ['ESPACES_VERTS', 'Mobilier urbain (banc)', 'U', 2200],
  // ===== HYDRAULIQUE =====
  ['HYDRAULIQUE', 'Béton pour seuil / déversoir', 'M3', 1750],
  ['HYDRAULIQUE', 'Gabion 1x1x2 m rempli', 'M3', 850],
  ['HYDRAULIQUE', 'Enrochement de protection', 'M3', 320],
  ['HYDRAULIQUE', 'Perré maçonné de protection de berge', 'M2', 450],
  ['HYDRAULIQUE', 'Canal en béton préfabriqué', 'ML', 950],
];

export async function GET() {
  try {
    const existants = await prisma.prixReference.findMany({ select: { designation: true } });
    const set = new Set(existants.map((p: any) => p.designation.trim().toLowerCase()));

    let ajoutes = 0;
    for (const [corpsEtat, designation, unite, prixUnitaire] of CATALOGUE) {
      if (set.has(designation.trim().toLowerCase())) continue;
      await prisma.prixReference.create({
        data: { corpsEtat, designation, unite, prixUnitaire, source: 'Catalogue 2026', region: 'National', annee: 2026 },
      });
      ajoutes++;
    }
    const total = await prisma.prixReference.count();
    return NextResponse.json({ ok: true, message: 'Bibliothèque enrichie ✅', ajoutes, totalPrix: total });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
