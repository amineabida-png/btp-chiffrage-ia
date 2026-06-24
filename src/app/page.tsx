import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-maroc-nuit to-slate-900 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="text-maroc-rouge">●</span> BTP Métré <span className="text-maroc-vert">IA</span>
        </div>
        <nav className="flex gap-3">
          <Link href="/login" className="btn btn-ghost">Connexion</Link>
          <Link href="/register" className="btn btn-primary">Créer un compte</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20 text-center">
        <p className="mb-3 inline-block rounded-full bg-white/10 px-4 py-1 text-sm">🇲🇦 Solution 100 % marocaine</p>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight">
          Vos plans <span className="text-maroc-vert">BTP</span> transformés en métré détaillé
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Importez vos plans (DXF, PDF ou image). L'application lit la géométrie et les cotes,
          puis produit un <b>métré structuré et fiable</b> — longueurs, surfaces, volumes et comptages,
          regroupés par poste, exportables en Excel.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link href="/register" className="btn btn-primary px-6 py-3 text-base">Démarrer gratuitement</Link>
          <Link href="/login" className="btn btn-ghost px-6 py-3 text-base">J'ai déjà un compte</Link>
        </div>

        <div className="mt-20 grid gap-6 text-left md:grid-cols-3">
          {[
            ['📐 Métré depuis plans', 'Importez vos plans DXF, PDF ou images : l\'IA produit un métré détaillé et structuré (longueurs, surfaces, volumes, comptages).'],
            ['📏 Géométrie exacte (DXF)', 'Lecture de la vraie géométrie par calque : longueurs et surfaces calculées précisément, pas devinées.'],
            ['🏗️ Structuré par poste', 'Ouvrages regroupés par corps d\'état, avec localisation, mode de calcul et observations.'],
            ['🔎 Lecture des cotes', 'L\'IA exploite en priorité les cotes, nomenclatures et tableaux du plan — jamais de quantité inventée.'],
            ['📊 Export Excel', 'Métré exportable en Excel, prêt à transmettre ou à chiffrer ailleurs.'],
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
        BTP Métré IA — Métré automatique des plans, à valider par un métreur.
      </footer>
    </div>
  );
}
