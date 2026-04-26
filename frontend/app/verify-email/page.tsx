'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { firebaseUser, student, token, loading, refreshStudent } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);

  // Redirect if already verified
  useEffect(() => {
    if (!loading && student?.emailVerified) {
      router.push('/dashboard');
    }
  }, [student, loading, router]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-send OTP on mount
  useEffect(() => {
    if (token && !otpSent && student && !student.emailVerified) {
      handleSendOTP();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, student]);

  const handleSendOTP = async () => {
    if (!token || sending) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await authApi.sendOTP(token) as { message: string; data?: { email: string } };
      setMaskedEmail(res.data?.email || student?.email || '');
      setSuccess(res.message || 'OTP sent!');
      setCooldown(60);
      setOtpSent(true);
      // Focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP';
      if (msg.includes('wait')) {
        // Extract seconds from the error message
        const match = msg.match(/(\d+)\s*seconds/);
        if (match) setCooldown(parseInt(match[1]));
      }
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    if (!token) return;
    setVerifying(true);
    setError('');
    setSuccess('');
    try {
      await authApi.verifyOTP(token, code);
      setSuccess('Email verified successfully! Redirecting…');
      // Refresh the student profile so emailVerified is updated in context
      await refreshStudent();
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      // Clear OTP on failure
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  // Auto-submit when all digits are entered
  useEffect(() => {
    if (otp.every((d) => d !== '') && !verifying) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center">
        <div className="text-center">
          <div className="font-headline font-black text-4xl tracking-tighter text-ink animate-pulse">STUDEX</div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mt-2">Loading…</p>
        </div>
      </div>
    );
  }

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
              Verify Email
            </h1>
          </div>
          <span className="font-headline font-black text-2xl tracking-tighter text-ink">
            STUDEX
          </span>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-surface-container-lowest editorial-shadow p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full bg-amber/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber text-4xl">mark_email_read</span>
            </div>
          </div>

          <div className="mb-8 text-center">
            <h2 className="font-headline font-extrabold text-3xl leading-tight mb-3 tracking-tight text-ink">
              CHECK YOUR<br />INBOX
            </h2>
            <p className="font-body text-on-surface-variant/70 text-sm tracking-wide">
              {maskedEmail ? (
                <>We sent a 6-digit code to <span className="font-bold text-ink">{maskedEmail}</span></>
              ) : (
                'We\'ll send a verification code to your email'
              )}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-sm font-body text-center">
              {error}
            </div>
          )}

          {success && !error && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-sm font-body text-center border border-green-200">
              {success}
            </div>
          )}

          {/* OTP Input */}
          <form onSubmit={handleVerify}>
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
                  disabled={verifying}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={verifying || otp.some((d) => d === '')}
              className="w-full bg-ink text-[#F7F4EF] py-5 rounded-full font-headline font-bold text-lg tracking-widest uppercase hover:opacity-90 snappy flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                  Verifying…
                </>
              ) : (
                <>
                  Verify Email
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                </>
              )}
            </button>
          </form>

          {/* Resend */}
          <div className="mt-8 text-center">
            {cooldown > 0 ? (
              <p className="font-mono text-[11px] text-on-surface-variant/60 tracking-wider">
                Resend available in <span className="font-bold text-ink">{cooldown}s</span>
              </p>
            ) : (
              <button
                onClick={handleSendOTP}
                disabled={sending}
                className="font-body text-sm text-ink font-bold underline decoration-amber decoration-2 underline-offset-4 hover:text-amber snappy disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Resend OTP'}
              </button>
            )}
          </div>

          <div className="mt-8 text-center">
            <p className="font-mono text-[10px] text-on-surface-variant/60 tracking-widest uppercase">
              Check your spam folder if you don't see the email
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
          OTP
        </div>
      </div>
    </div>
  );
}
