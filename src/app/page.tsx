import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-maroc-nuit to-slate-900 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="text-maroc-rouge">●</span> BTP Chiffrage <span className="text-maroc-vert">IA</span>
        </div>
        <nav className="flex gap-3">
          <Link href="/login" className="btn btn-ghost">Connexion</Link>
          <Link href="/register" className="btn btn-primary">Créer un compte</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20 text-center">
        <p className="mb-3 inline-block rounded-full bg-white/10 px-4 py-1 text-sm">🇲🇦 Solution 100 % marocaine</p>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight">
          Chiffrez vos appels d'offres <span className="text-maroc-vert">BTP</span> en quelques minutes
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Importez le BPU, le DQE, le CPS et les plans. L'intelligence artificielle analyse le marché,
          extrait les articles, établit les sous-détails de prix en Dirhams, détecte les risques et génère
          tous les exports — réduction de plus de 90 % du temps de préparation.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link href="/register" className="btn btn-primary px-6 py-3 text-base">Démarrer gratuitement</Link>
          <Link href="/login" className="btn btn-ghost px-6 py-3 text-base">J'ai déjà un compte</Link>
        </div>

        <div className="mt-20 grid gap-6 text-left md:grid-cols-3">
          {[
            ['📄 Analyse automatique', 'Extraction de l\'objet, maître d\'ouvrage, cautions, qualifications, pénalités, délais — conforme au décret 2-22-431.'],
            ['🧮 Chiffrage IA', 'Déboursé sec, frais de chantier, frais généraux, aléas et marge. Coefficients personnalisables.'],
            ['⚠️ Détection des risques', 'Score de risque global, alertes de cohérence CPS/BPU et recommandations.'],
            ['💾 Base de prix Maroc', 'Bâtiment, VRD, assainissement, AEP, routes, génie civil… enrichie à chaque projet.'],
            ['📊 Exports complets', 'Bordereau chiffré Excel, sous-détails, rapports PDF, conditions du marché.'],
            ['👥 Multi-utilisateurs', 'Administrateur, directeur, métreur, chargé d\'étude, consultation.'],
          ].map(([t, d]) => (
            <div key={t} className="card bg-white/5 text-white">
              <h3 className="mb-2 font-semibold">{t}</h3>
              <p className="text-sm text-slate-300">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-white/10 py-6 text-center text-sm text-slate-400">
        BTP Chiffrage IA — Estimations indicatives à valider par un métreur.
      </footer>
    </div>
  );
}
