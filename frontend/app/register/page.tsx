'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    college: '',
    referralCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Create Firebase account
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      // 2. Send verification email (non-blocking — user can verify later)
      sendEmailVerification(cred.user).catch(() => {});
      // 3. Get token & register profile in backend
      const token = await cred.user.getIdToken();
      await authApi.registerStudent(token, {
        name: form.name,
        ...(form.phone ? { phone: form.phone } : {}),
        college: form.college,
        ...(form.referralCode ? { referralCode: form.referralCode } : {}),
      });
      // 4. Redirect directly to dashboard
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.includes('email-already-in-use')) {
        setError('An account with this email already exists.');
      } else if (msg.includes('weak-password')) {
        setError('Password must be at least 6 characters.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EF] flex flex-col">
      {/* Header */}
      <header className="bg-[#F7F4EF] z-50 sticky top-0">
        <div className="flex items-center justify-between px-6 h-20 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:opacity-80 snappy text-ink">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="font-headline uppercase tracking-tighter font-bold text-2xl text-ink">
              Join StudEX
            </h1>
          </div>
          <span className="font-headline font-black text-2xl tracking-tighter text-ink">
            THE REGISTER
          </span>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-surface-container-lowest editorial-shadow p-8 md:p-12">
          <div className="mb-12">
            <h2 className="font-headline font-extrabold text-4xl leading-tight mb-2 tracking-tight text-ink">
              CREATE YOUR<br />PROFILE
            </h2>
            <p className="font-body text-on-surface-variant/70 text-sm tracking-wide uppercase font-medium">
              Start your journey with The Broadsheet
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm font-body">
              {error}
            </div>
          )}

          <form className="space-y-8" onSubmit={handleRegister}>
            {/* Name */}
            <div className="relative">
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Your Full Name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="input-underline"
              />
            </div>

            {/* Email */}
            <div className="relative">
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@college.edu"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="input-underline"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="input-underline"
              />
            </div>

            {/* Phone */}
            <div className="relative">
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                Phone Number (10 digits)
              </label>
              <input
                type="tel"
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="input-underline"
              />
            </div>

            {/* College */}
            <div className="relative">
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                Institution / College
              </label>
              <input
                type="text"
                required
                placeholder="Your College Name"
                value={form.college}
                onChange={(e) => update('college', e.target.value)}
                className="input-underline"
              />
            </div>

            {/* Referral Code */}
            <div className="relative pb-4">
              <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                maxLength={8}
                placeholder="8-character code"
                value={form.referralCode}
                onChange={(e) => update('referralCode', e.target.value.toUpperCase())}
                className="input-underline font-mono"
              />
            </div>

            {/* Terms consent */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms-agree"
                required
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 accent-amber cursor-pointer flex-shrink-0"
              />
              <label htmlFor="terms-agree" className="font-body text-xs text-on-surface-variant leading-relaxed cursor-pointer">
                I have read and agree to the{' '}
                <Link href="/terms" target="_blank" className="text-ink font-bold underline underline-offset-2 hover:text-primary">
                  Terms and Conditions
                </Link>{' '}&amp;{' '}
                <Link href="/terms" target="_blank" className="text-ink font-bold underline underline-offset-2 hover:text-primary">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full bg-ink text-[#F7F4EF] py-5 rounded-full font-headline font-bold text-lg tracking-widest uppercase hover:opacity-90 snappy flex items-center justify-center gap-3 mt-4 disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create Account'}
              {!loading && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="font-mono text-[10px] text-on-surface-variant/60 tracking-widest uppercase">
              By registering you agree to our editorial standards.
            </p>
            <p className="mt-4 text-sm text-on-surface-variant">
              Already registered?{' '}
              <Link href="/login" className="font-bold underline decoration-primary-container decoration-2 underline-offset-4 hover:text-primary snappy">
                Login
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Dark footer */}
      <footer className="bg-ink py-12">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-screen-xl mx-auto gap-8">
          <span className="font-headline font-bold text-amber text-xl tracking-tighter">STUDEX</span>
          <div className="flex gap-6">
            <Link href="/terms" className="font-mono text-[10px] uppercase tracking-widest text-stone-400 hover:text-amber snappy">Terms &amp; Conditions</Link>
            <Link href="/terms" className="font-mono text-[10px] uppercase tracking-widest text-stone-400 hover:text-amber snappy">Privacy Policy</Link>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-stone-400">© 2024 THE DIGITAL BROADSHEET</span>
        </div>
      </footer>

      {/* Decorative large text */}
      <div className="fixed bottom-0 right-0 p-12 opacity-5 pointer-events-none hidden lg:block">
        <div className="font-headline font-black text-[20rem] leading-none select-none text-ink">
          REG
        </div>
      </div>
    </div>
  );
}
