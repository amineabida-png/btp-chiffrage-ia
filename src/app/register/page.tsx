'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ nom: '', email: '', motDePasse: '', entreprise: '' });
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErreur('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErreur(data.error || 'Erreur'); setLoading(false); return; }
    await signIn('credentials', { email: form.email, password: form.motDePasse, redirect: false });
    router.push('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-6 text-2xl font-bold">Créer un compte</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><label className="label">Nom complet</label><input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
          <div><label className="label">Entreprise</label><input className="input" value={form.entreprise} onChange={(e) => setForm({ ...form, entreprise: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><label className="label">Mot de passe</label><input className="input" type="password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} required minLength={6} /></div>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'}</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">Déjà inscrit ? <Link href="/login" className="text-maroc-vert font-medium">Connexion</Link></p>
      </div>
    </div>
  );
}
