'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const { firebaseUser, student, loading } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => { setVisible(true); }, []);
  useEffect(() => {
    // Only redirect if we have both a Firebase session AND a confirmed backend profile.
    // This prevents stale/unknown Firebase sessions from hijacking the landing page.
    if (!loading && firebaseUser && student) router.push('/dashboard');
  }, [firebaseUser, student, loading, router]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F7F4EF] flex flex-col overflow-x-hidden w-full">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-8">
        <h1 className="font-headline font-black text-2xl tracking-tighter uppercase text-ink">
          STUDEX
        </h1>
        <Link
          href="/login"
          className="font-mono text-xs uppercase tracking-widest text-muted hover:text-ink transition-colors snappy"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <main
        className={`flex-1 flex flex-col justify-center px-6 w-full transition-all duration-700 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary font-bold mb-5">
          Digital Broadsheet — Vol. 01
        </span>

        <h2 className="font-headline font-black text-[clamp(3rem,14vw,5.5rem)] uppercase leading-none tracking-tighter text-ink mb-6">
          YOUR<br />CAMPUS.<br />YOUR<br />DEALS.
        </h2>

        <div className="relative inline-block mb-10 self-start">
          <p className="font-body text-base text-on-surface-variant font-medium pr-1">
            Hyperlocal deals · Cashback · Careers
          </p>
          <div className="absolute -bottom-2 left-0 w-full h-1.5 bg-amber" />
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-12">
          {['🏷️ Deals', '💳 Wallet', '🎓 Careers', '🔐 Verified ID'].map((f) => (
            <span
              key={f}
              className="bg-surface-container-lowest border border-outline-variant/40 px-3 py-2 rounded-full font-body text-sm font-bold text-ink editorial-shadow"
            >
              {f}
            </span>
          ))}
        </div>
      </main>

      {/* CTA */}
      <section
        className={`px-6 pb-12 transition-all duration-700 delay-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <Link
          href="/register"
          id="cta-get-started"
          className="w-full flex items-center justify-between bg-ink text-[#F7F4EF] px-6 py-5 rounded-full font-headline font-bold uppercase text-base tracking-widest hover:bg-charcoal snappy editorial-shadow"
        >
          Get Started
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
        <p className="mt-5 font-mono text-xs uppercase tracking-widest text-muted">
          Already on the broadsheet?{' '}
          <Link
            href="/login"
            className="text-primary font-bold underline decoration-primary-container decoration-2 underline-offset-4 hover:text-ink snappy"
          >
            Log In
          </Link>
        </p>
      </section>

      {/* Sidebar editorial decoration — desktop only */}
      <aside className="hidden lg:flex fixed left-10 top-1/2 -translate-y-1/2">
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted opacity-40 editorial-sidebar">
          Digital Publication © 2024 — Issue 04
        </div>
      </aside>

      {/* Footer */}
      <footer className="border-t border-outline-variant/20 px-6 py-6 w-full space-y-4">
        {/* Creator credit */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img
              src="https://avatars.githubusercontent.com/u/121279187?v=4"
              alt="Harsh Kulhade"
              className="w-8 h-8 rounded-full object-cover border border-outline-variant/40"
            />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Created by</p>
              <p className="font-headline font-bold text-sm uppercase text-ink tracking-tight">Harsh Kulhade</p>
            </div>
          </div>
          {/* Social links */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/HarshKulhade"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-ink snappy"
              aria-label="GitHub"
            >
              {/* GitHub SVG icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/harshkulhade"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-ink snappy"
              aria-label="LinkedIn"
            >
              {/* LinkedIn SVG icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
            <a
              href="https://www.instagram.com/harshhkulhade"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-ink snappy"
              aria-label="Instagram"
            >
              {/* Instagram SVG icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              Instagram
            </a>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-t border-outline-variant/10 pt-4">
          <div className="flex gap-6 font-mono text-[10px] uppercase tracking-widest text-muted">
            <Link href="/terms" className="hover:text-ink snappy">Terms &amp; Conditions</Link>
            <Link href="/terms" className="hover:text-ink snappy">Privacy Policy</Link>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted/50">© 2025 StudEX</span>
        </div>
      </footer>
    </div>
  );
}
