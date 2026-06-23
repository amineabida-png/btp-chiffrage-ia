import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import SidebarNav from '@/components/SidebarNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return (
    <div className="flex min-h-screen bg-slate-100">
      <SidebarNav user={session.user as any} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
