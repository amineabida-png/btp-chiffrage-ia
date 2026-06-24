'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErreur('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setErreur('Email ou mot de passe incorrect.');
    else router.push('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold">Connexion</h1>
        <p className="mb-6 text-sm text-slate-500">BTP Métré IA — Maroc</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Pas de compte ? <Link href="/register" className="text-maroc-vert font-medium">Créer un compte</Link>
        </p>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Démo : admin@btp-maroc.ma / Admin2026!
        </div>
      </div>
    </div>
  );
}
