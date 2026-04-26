'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

type Step = 'email' | 'otp' | 'newPassword' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // ── Step 1: Send OTP ──
  const handleSendOTP = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) { setError('Please enter your email address.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email) as { data?: { email: string } };
      setMaskedEmail(res.data?.email || email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));
      setStep('otp');
      setCooldown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP';
      if (msg.includes('wait')) {
        const match = msg.match(/(\d+)\s*seconds/);
        if (match) setCooldown(parseInt(match[1]));
        setStep('otp');
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ──
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 2: Verify OTP ──
  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.verifyResetOTP(email, code);
      setStep('newPassword');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      if (msg.includes('expired')) {
        setTimeout(() => {
          setOtp(['', '', '', '', '', '']);
          setError('');
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset password ──
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const code = otp.join('');
    if (code.length !== 6) {
      setError('Invalid OTP. Please go back and re-enter.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(email, code, newPassword);
      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      if (msg.includes('expired') || msg.includes('Invalid OTP')) {
        setError(msg + ' Going back to OTP step…');
        setTimeout(() => {
          setOtp(['', '', '', '', '', '']);
          setStep('otp');
          setError('');
        }, 2000);
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
            <Link href="/login" className="hover:opacity-80 snappy text-ink">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="font-headline uppercase tracking-tighter font-bold text-2xl text-ink">
              Reset Password
            </h1>
          </div>
          <span className="font-headline font-black text-2xl tracking-tighter text-ink">
            STUDEX
          </span>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-surface-container-lowest editorial-shadow p-8 md:p-12">

          {/* ── Step 1: Enter Email ── */}
          {step === 'email' && (
            <>
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-full bg-amber/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber text-4xl">lock_reset</span>
                </div>
              </div>
              <div className="mb-8 text-center">
                <h2 className="font-headline font-extrabold text-3xl leading-tight mb-3 tracking-tight text-ink">
                  FORGOT YOUR<br />PASSWORD?
                </h2>
                <p className="font-body text-on-surface-variant/70 text-sm">
                  Enter your email and we&apos;ll send a verification code to reset it.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm font-body text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSendOTP} className="space-y-6">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-underline"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink text-[#F7F4EF] py-5 rounded-full font-headline font-bold text-lg tracking-widest uppercase hover:opacity-90 snappy flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send Reset Code'}
                  {!loading && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
                </button>
              </form>

              <div className="mt-8 text-center">
                <Link href="/login" className="font-body text-sm text-ink font-bold underline decoration-amber decoration-2 underline-offset-4 hover:text-amber snappy">
                  Back to Login
                </Link>
              </div>
            </>
          )}

          {/* ── Step 2: Enter OTP ── */}
          {step === 'otp' && (
            <>
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-full bg-amber/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber text-4xl">mark_email_read</span>
                </div>
              </div>
              <div className="mb-8 text-center">
                <h2 className="font-headline font-extrabold text-3xl leading-tight mb-3 tracking-tight text-ink">
                  ENTER THE<br />CODE
                </h2>
                <p className="font-body text-on-surface-variant/70 text-sm">
                  We sent a 6-digit code to <span className="font-bold text-ink">{maskedEmail}</span>
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm font-body text-center">
                  {error}
                </div>
              )}

              <div className="flex justify-center gap-3 mb-8">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                      if (pastedData) handleOtpChange(index, pastedData);
                    }}
                    className={`w-12 h-14 text-center text-2xl font-mono font-bold border-2 rounded-xl bg-[#F7F4EF] outline-none snappy
                      ${digit ? 'border-ink text-ink' : 'border-outline/30 text-muted'}
                      focus:border-amber focus:ring-2 focus:ring-amber/20`}
                    disabled={loading}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={loading || otp.some((d) => d === '')}
                className="w-full bg-ink text-[#F7F4EF] py-5 rounded-full font-headline font-bold text-lg tracking-widest uppercase hover:opacity-90 snappy flex items-center justify-center gap-3 disabled:opacity-50 mb-6"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                    Verifying…
                  </>
                ) : (
                  <>
                    Verify Code
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  </>
                )}
              </button>

              {/* Resend */}
              <div className="text-center">
                {cooldown > 0 ? (
                  <p className="font-mono text-[11px] text-on-surface-variant/60 tracking-wider">
                    Resend available in <span className="font-bold text-ink">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={() => handleSendOTP()}
                    disabled={loading}
                    className="font-body text-sm text-ink font-bold underline decoration-amber decoration-2 underline-offset-4 hover:text-amber snappy disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Resend Code'}
                  </button>
                )}
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError(''); }}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-ink snappy"
                >
                  ← Change email
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: New Password ── */}
          {step === 'newPassword' && (
            <>
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-full bg-amber/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber text-4xl">password</span>
                </div>
              </div>
              <div className="mb-8 text-center">
                <h2 className="font-headline font-extrabold text-3xl leading-tight mb-3 tracking-tight text-ink">
                  SET YOUR<br />NEW PASSWORD
                </h2>
                <p className="font-body text-on-surface-variant/70 text-sm">
                  Choose a strong password with at least 6 characters.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm font-body text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-underline pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink snappy"
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-underline"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink text-[#F7F4EF] py-5 rounded-full font-headline font-bold text-lg tracking-widest uppercase hover:opacity-90 snappy flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                      Resetting…
                    </>
                  ) : (
                    <>
                      Reset Password
                      <span className="material-symbols-outlined text-xl">check_circle</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => { setStep('otp'); setError(''); }}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-ink snappy"
                >
                  ← Back to OTP
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Success ── */}
          {step === 'done' && (
            <>
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
                </div>
              </div>
              <div className="mb-8 text-center">
                <h2 className="font-headline font-extrabold text-3xl leading-tight mb-3 tracking-tight text-ink">
                  PASSWORD<br />RESET!
                </h2>
                <p className="font-body text-on-surface-variant/70 text-sm">
                  Your password has been updated successfully. You can now log in with your new password.
                </p>
              </div>

              <button
                onClick={() => router.push('/login')}
                className="w-full bg-ink text-[#F7F4EF] py-5 rounded-full font-headline font-bold text-lg tracking-widest uppercase hover:opacity-90 snappy flex items-center justify-center gap-3"
              >
                Go to Login
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            </>
          )}
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
        <div className="font-headline font-black text-[16rem] leading-none select-none text-ink">
          RESET
        </div>
      </div>
    </div>
  );
}
