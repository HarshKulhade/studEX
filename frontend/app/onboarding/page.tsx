'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingPage() {
  const { firebaseUser, student, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect to login if fully loaded and no authenticated session exists
    if (!loading && !firebaseUser) router.push('/login');
  }, [firebaseUser, loading, router]);

  return (
    <div className="min-h-screen bg-[#F7F4EF]">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full px-6 py-8 flex justify-between items-center z-50">
        <div className="font-headline font-black text-2xl tracking-tighter text-ink uppercase">StudEX</div>
        <div className="font-mono text-[12px] uppercase tracking-widest text-secondary font-bold">Verification</div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24 space-y-24">
        {/* Hero */}
        <section className="flex flex-col justify-center items-start space-y-12">
          <div className="space-y-4">
            <h1 className="font-headline font-extrabold text-7xl md:text-9xl uppercase leading-none tracking-tighter text-ink">
              StudEX
            </h1>
            <div className="relative inline-block">
              <p className="font-body text-xl md:text-2xl font-medium text-secondary">Save More. Spend Less.</p>
              <div className="absolute -bottom-2 left-0 w-full h-1.5 bg-primary-container" />
            </div>
          </div>
          <Link
            href="/profile"
            className="group flex items-center space-x-4 bg-ink text-white px-8 py-5 rounded-full hover:scale-95 snappy"
          >
            <span className="font-body font-bold uppercase tracking-widest text-sm">Go to Profile</span>
            <span className="material-symbols-outlined text-amber">arrow_forward</span>
          </Link>
        </section>

        {/* Verification Options */}
        <section className="space-y-12">
          <div className="space-y-2">
            <span className="font-mono text-tertiary font-bold uppercase text-xs tracking-widest">Security First</span>
            <h2 className="font-headline font-extrabold text-5xl md:text-6xl uppercase leading-tight max-w-2xl text-ink">
              Verify you&apos;re a student
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Method A */}
            <Link href="/profile" className="group relative flex flex-col justify-between p-8 bg-surface-container-lowest rounded-lg h-80 text-left hover:bg-ink hover:text-white snappy overflow-hidden editorial-shadow">
              <div className="space-y-4 z-10 relative">
                <span className="material-symbols-outlined text-4xl text-amber group-hover:text-amber">badge</span>
                <h3 className="font-headline font-extrabold text-3xl uppercase text-ink group-hover:text-white">Upload College ID</h3>
                <p className="font-body opacity-70 max-w-[200px] text-on-surface-variant group-hover:text-white/70">
                  Snap a photo of your physical student card for admin review.
                </p>
              </div>
              <div className="flex justify-between items-end z-10 relative">
                <span className="font-mono text-xs font-bold tracking-tighter uppercase opacity-50">Method A</span>
                <span className="material-symbols-outlined text-3xl group-hover:translate-x-2 snappy">arrow_forward</span>
              </div>
              <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 snappy">
                <span className="material-symbols-outlined text-[200px]">camera_alt</span>
              </div>
            </Link>

            {/* Method B — enrollment number */}
            <div className="group relative flex flex-col justify-between p-8 bg-surface-container-lowest rounded-lg h-80 text-left hover:bg-ink hover:text-white snappy overflow-hidden editorial-shadow cursor-default">
              <div className="space-y-4 z-10 relative">
                <span className="material-symbols-outlined text-4xl text-amber group-hover:text-amber">fingerprint</span>
                <h3 className="font-headline font-extrabold text-3xl uppercase text-ink group-hover:text-white">Enrollment Letter</h3>
                <p className="font-body opacity-70 max-w-[200px] text-on-surface-variant group-hover:text-white/70">
                  Upload your official enrollment letter for manual verification.
                </p>
              </div>
              <div className="flex justify-between items-end z-10 relative">
                <span className="font-mono text-xs font-bold tracking-tighter uppercase opacity-50">Method B</span>
                <span className="material-symbols-outlined text-3xl group-hover:translate-x-2 snappy">arrow_forward</span>
              </div>
              <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 snappy">
                <span className="material-symbols-outlined text-[200px]">pin</span>
              </div>
            </div>
          </div>

          {/* Trust badge */}
          <div className="bg-surface-container-high border-2 border-dashed border-outline-variant p-6 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="material-symbols-outlined text-tertiary">verified_user</span>
              <div>
                <p className="font-body font-bold text-sm text-ink">Encrypted & Secure</p>
                <p className="font-mono text-[10px] text-secondary uppercase">Your data is never stored locally</p>
              </div>
            </div>
            <span className="hidden md:block font-mono text-xs font-medium text-outline">SECURE_CHANNEL_V2.0</span>
          </div>
        </section>
      </main>

      {/* Footer Action Bar */}
      <footer className="fixed bottom-0 left-0 w-full bg-surface-container-lowest px-6 py-6 flex justify-between items-center z-50 shadow-[0_-4px_20px_rgba(26,26,24,0.05)] md:px-12">
        <Link href="/dashboard" className="text-secondary font-body font-bold text-sm uppercase tracking-widest hover:text-ink snappy">
          Skip for now
        </Link>
        <div className="flex items-center space-x-6">
          <div className="flex space-x-2">
            <div className="w-8 h-1 bg-ink" />
            <div className="w-8 h-1 bg-surface-container-highest" />
            <div className="w-8 h-1 bg-surface-container-highest" />
          </div>
          <Link href="/profile" className="bg-amber text-ink w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 snappy editorial-shadow">
            <span className="material-symbols-outlined">chevron_right</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
