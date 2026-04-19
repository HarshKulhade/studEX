'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken();
      // Sync with backend
      await authApi.loginStudent(token);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      if (message.includes('user-not-found') || message.includes('wrong-password') || message.includes('invalid-credential')) {
        setError('Invalid email or password.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email first.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch {
      setError('Could not send reset email.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EF] flex flex-col">
      {/* Header */}
      <header className="flex justify-center items-center w-full px-8 py-10 bg-[#F7F4EF]">
        <Link href="/">
          <h1 className="font-headline font-black text-4xl tracking-tighter text-ink uppercase">
            STUDEX
          </h1>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          {/* Hero text */}
          <div className="mb-12">
            <h2 className="font-headline font-black text-7xl tracking-tighter uppercase leading-none mb-4 text-ink">
              LOGIN
            </h2>
            <p className="text-lg font-medium text-on-surface-variant max-w-xs">
              Welcome back to the broadsheet.
            </p>
          </div>

          {/* Error / success */}
          {error && (
            <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg font-body text-sm">
              {error}
            </div>
          )}
          {resetSent && (
            <div className="mb-6 p-4 bg-surface-container-high text-ink rounded-lg font-body text-sm">
              Password reset email sent! Check your inbox.
            </div>
          )}

          {/* Form */}
          <form className="space-y-8" onSubmit={handleLogin}>
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs uppercase tracking-widest text-on-surface-variant" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@college.edu"
                  className="input-underline bg-surface-container-high"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <label className="font-mono text-xs uppercase tracking-widest text-on-surface-variant" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-secondary hover:text-primary snappy underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-underline bg-surface-container-high"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-[#F7F4EF] py-5 rounded-full font-headline uppercase tracking-tight text-xl flex justify-center items-center gap-3 hover:bg-charcoal snappy editorial-shadow disabled:opacity-50"
            >
              {loading ? 'Logging in…' : 'Login'}
              {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-on-surface-variant">
              New here?{' '}
              <Link href="/register" className="font-bold underline decoration-primary-container decoration-2 underline-offset-4 hover:text-primary snappy">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Sidebar decoration */}
      <aside className="hidden lg:block fixed left-12 top-1/2 -translate-y-1/2 -rotate-90 origin-left">
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted opacity-40">
          Digital Publication © 2024 — Volume 01. Issue 04
        </div>
      </aside>

      {/* Footer */}
      <footer className="w-full py-10 px-8 flex justify-between items-end border-t border-outline-variant/20 max-w-7xl mx-auto">
        <div className="font-mono text-[10px] uppercase text-on-surface-variant flex gap-8">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
        <span className="font-mono text-3xl font-black text-ink/5">EST. 2024</span>
      </footer>
    </div>
  );
}
