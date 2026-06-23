import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

function mad(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' MAD'; }

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const projets = await prisma.projet.findMany({
    where: { userId }, orderBy: { updatedAt: 'desc' }, take: 8,
    include: { _count: { select: { articles: true, alertes: true } } },
  });
  const total = await prisma.projet.count({ where: { userId } });
  const gagnes = await prisma.projet.count({ where: { userId, statut: 'GAGNE' } });
  const prixCount = await prisma.prixReference.count();
  const montants = await prisma.article.aggregate({ _sum: { montantTotal: true }, where: { projet: { userId } } });
  const tauxReussite = total > 0 ? Math.round((gagnes / total) * 100) : 0;

  const stats = [
    ['Appels d\'offres', total, '📁'],
    ['Taux de réussite', tauxReussite + ' %', '🎯'],
    ['Montant chiffré', mad(montants._sum.montantTotal || 0), '💰'],
    ['Prix en base', prixCount, '💾'],
  ] as const;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <Link href="/projects" className="btn btn-primary">+ Nouvel appel d'offres</Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {stats.map(([label, val, icon]) => (
          <div key={label} className="card">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 text-2xl font-bold">{val}</div>
            <div className="text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Derniers appels d'offres</h2>
      <div className="card p-0">
        {projets.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Aucun projet. <Link href="/projects" className="text-maroc-vert">Créez votre premier appel d'offres</Link>.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-500">
              <tr><th className="p-3">Objet</th><th className="p-3">Statut</th><th className="p-3">Articles</th><th className="p-3">Alertes</th><th className="p-3">Risque</th></tr>
            </thead>
            <tbody>
              {projets.map((p: any) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3"><Link href={`/projects/${p.id}`} className="font-medium text-maroc-vert hover:underline">{p.objet}</Link></td>
                  <td className="p-3"><span className="badge bg-slate-100 text-slate-600">{p.statut}</span></td>
                  <td className="p-3">{p._count.articles}</td>
                  <td className="p-3">{p._count.alertes}</td>
                  <td className="p-3">{p.scoreRisque != null ? `${p.scoreRisque}/100` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
