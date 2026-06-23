// Moteur de calcul des prix — pratiques BTP marocaines (MAD HT)

export interface Coefficients {
  fraisChantier: number;   // % du déboursé sec
  fraisGeneraux: number;   // %
  aleas: number;           // %
  marge: number;           // %
}

export const COEFFICIENTS_DEFAUT: Coefficients = {
  fraisChantier: 8,   // 8 %
  fraisGeneraux: 10,  // 10 %
  aleas: 3,           // 3 %
  marge: 8,           // 8 %
};

export interface DeboursesArticle {
  prixFournitures: number;
  prixMainOeuvre: number;
  prixMateriel: number;
  prixEngins: number;
  prixTransport: number;
  prixSousTraitance: number;
}

export function calculerPrix(d: DeboursesArticle, c: Coefficients = COEFFICIENTS_DEFAUT) {
  const deboursesSec =
    d.prixFournitures + d.prixMainOeuvre + d.prixMateriel +
    d.prixEngins + d.prixTransport + d.prixSousTraitance;

  const fraisChantier = deboursesSec * (c.fraisChantier / 100);
  const fraisGeneraux = (deboursesSec + fraisChantier) * (c.fraisGeneraux / 100);
  const sousTotal = deboursesSec + fraisChantier + fraisGeneraux;
  const aleas = sousTotal * (c.aleas / 100);
  const prixRevient = sousTotal + aleas;
  const marge = prixRevient * (c.marge / 100);
  const prixUnitaire = prixRevient + marge;

  return {
    deboursesSec: round(deboursesSec),
    fraisChantier: round(fraisChantier),
    fraisGeneraux: round(fraisGeneraux),
    aleas: round(aleas),
    prixRevient: round(prixRevient),
    marge: round(marge),
    prixUnitaire: round(prixUnitaire),
  };
}

function round(n: number) { return Math.round(n * 100) / 100; }

export function formatMAD(n: number): string {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 }).format(n || 0);
}
