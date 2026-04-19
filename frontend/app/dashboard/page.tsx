'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { studentApi } from '@/lib/api';
import BottomNav from '@/components/BottomNav';

interface DashboardData {
  wallet: { balance: number; totalEarned: number; totalWithdrawn: number };
  recentRedemptions: Array<{ _id: string; deal: string; status: string; cashbackAmount: number; generatedAt: unknown }>;
  recentPrintJobs: Array<{ _id: string; fileName: string; status: string; totalCost: number; createdAt: unknown }>;
  nearbyDealsCount: number;
  profile: {
    name: string;
    college: string;
    verificationStatus: string;
    isVerified: boolean;
    avatarUrl?: string;
    ambassadorTier: string;
    totalReferrals: number;
  };
}


const STATUS_COLORS: Record<string, string> = {
  verified: 'text-green-600',
  pending: 'text-amber',
  unverified: 'text-tertiary',
};

function formatDate(ts: unknown) {
  if (!ts) return '—';
  try {
    let d: Date;
    if ((ts as any).toDate) {
      d = (ts as any).toDate();
    } else if (typeof ts === 'object' && ts !== null && '_seconds' in ts) {
      d = new Date((ts as any)._seconds * 1000);
    } else {
      d = new Date(ts as string | number);
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function DashboardPage() {
  const { firebaseUser, student, token, loading, logout, walletBalance } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fetching, setFetching] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await studentApi.getDashboard(token) as { data: DashboardData };
      setData(res.data);
    } catch {
      // silently fail
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    if (token) loadDashboard();
  }, [token, loadDashboard]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center">
        <div className="text-center">
          <div className="font-headline font-black text-4xl tracking-tighter text-ink animate-pulse">STUDEX</div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mt-2">Loading…</p>
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  // Use global walletBalance from AuthContext for reactivity across pages
  const verificationStatus = profile?.verificationStatus || student?.verificationStatus || 'unverified';
  const displayName = profile?.name || student?.name || 'Student';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#F7F4EF] pb-28">
      {/* Top App Bar */}
      <header className="bg-[#F7F4EF] sticky top-0 z-40 flex justify-between items-center w-full px-6 py-4">
        <div>
          <span className="font-headline font-black text-2xl tracking-tighter text-ink uppercase">StudEX</span>
          {profile?.college && (
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{profile.college}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadDashboard} className="w-10 h-10 flex items-center justify-center text-muted hover:text-ink snappy">
            <span className="material-symbols-outlined text-xl">refresh</span>
          </button>
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-amber flex items-center justify-center text-white font-headline font-bold border-2 border-white editorial-shadow overflow-hidden cursor-pointer"
            onClick={() => router.push('/profile')}>
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm">{initials}</span>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 space-y-8 mt-2">
        {/* Verification Banner */}
        {verificationStatus !== 'verified' && !student?.isVerified && (
          <section className="bg-surface-container-high border-l-4 border-amber p-5 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-body font-bold text-ink text-sm">Get Verified</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted mt-0.5">
                {verificationStatus === 'pending' ? 'Verification pending admin review' : 'Upload your college ID to unlock all deals'}
              </p>
            </div>
            {verificationStatus !== 'pending' && (
              <Link href="/onboarding" className="bg-ink text-[#F7F4EF] px-4 py-2 rounded-full font-headline font-bold text-xs uppercase snappy hover:bg-charcoal">
                Verify
              </Link>
            )}
          </section>
        )}

        {/* Greeting + Wallet Card */}
        <section>
          <div className="mb-4">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Welcome back,</p>
            <h2 className="font-headline font-extrabold text-4xl uppercase tracking-tighter text-ink leading-tight">
              {displayName.split(' ')[0]}
            </h2>
          </div>

          {/* Prepaid Wallet */}
          <div className="bg-charcoal text-white p-6 rounded-2xl relative overflow-hidden editorial-shadow">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber rotate-45 translate-x-10 -translate-y-10 opacity-80" />
            <div className="relative z-10">
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber">Personal Wallet</span>
              <div className="mt-3 mb-1">
                <span className="font-mono text-5xl font-bold">₹{walletBalance.toFixed(2)}</span>
              </div>
              <div className="flex gap-6 mt-3 text-white/70">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider">Total Added</p>
                  <p className="font-mono text-base font-bold text-white">₹{(data?.wallet?.totalEarned ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider">Total Spent</p>
                  <p className="font-mono text-base font-bold text-white">₹{(data?.wallet?.totalWithdrawn ?? 0).toFixed(2)}</p>
                </div>
              </div>
              <Link href="/wallet" className="mt-4 inline-flex items-center gap-2 bg-amber text-ink px-5 py-2 rounded-full font-headline font-bold text-xs uppercase snappy hover:opacity-90">
                Add Money <span className="material-symbols-outlined text-sm">add_circle</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Stats Row */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest editorial-shadow p-4 rounded-2xl text-center">
            <p className="font-mono text-2xl font-bold text-amber">{data?.nearbyDealsCount ?? 0}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-1">Nearby Deals</p>
          </div>
          <div className="bg-surface-container-lowest editorial-shadow p-4 rounded-2xl text-center">
            <p className="font-mono text-2xl font-bold text-ink">{walletBalance.toFixed(0)}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-1">Wallet Balance</p>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h3 className="font-headline font-bold text-xl uppercase tracking-tight text-ink mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/deals" className="bg-surface-container-lowest editorial-shadow p-5 rounded-2xl flex flex-col gap-3 hover:bg-charcoal hover:text-white group snappy">
              <span className="material-symbols-outlined text-amber text-3xl group-hover:text-amber">local_offer</span>
              <div>
                <p className="font-headline font-bold text-base uppercase">Deals</p>
                <p className="font-body text-xs text-muted group-hover:text-white/70">Browse nearby offers</p>
              </div>
            </Link>
            <Link href="/opportunities" className="bg-surface-container-lowest editorial-shadow p-5 rounded-2xl flex flex-col gap-3 hover:bg-charcoal hover:text-white group snappy">
              <span className="material-symbols-outlined text-amber text-3xl group-hover:text-amber">work</span>
              <div>
                <p className="font-headline font-bold text-base uppercase">Careers</p>
                <p className="font-body text-xs text-muted group-hover:text-white/70">Jobs & internships</p>
              </div>
            </Link>
            <Link href="/profile" className="bg-surface-container-lowest editorial-shadow p-5 rounded-2xl flex flex-col gap-3 hover:bg-charcoal hover:text-white group snappy">
              <span className="material-symbols-outlined text-amber text-3xl group-hover:text-amber">badge</span>
              <div>
                <p className="font-headline font-bold text-base uppercase">Profile</p>
                <p className={`font-mono text-xs uppercase ${STATUS_COLORS[verificationStatus] || 'text-muted'} group-hover:text-amber`}>
                  {verificationStatus}
                </p>
              </div>
            </Link>
            <Link href="/wallet" className="bg-surface-container-lowest editorial-shadow p-5 rounded-2xl flex flex-col gap-3 hover:bg-charcoal hover:text-white group snappy">
              <span className="material-symbols-outlined text-amber text-3xl group-hover:text-amber">account_balance_wallet</span>
              <div>
                <p className="font-headline font-bold text-base uppercase">Wallet</p>
                <p className="font-body text-xs text-muted group-hover:text-white/70">₹{walletBalance.toFixed(0)} available</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Recent Redemptions */}
        {(data?.recentRedemptions?.length ?? 0) > 0 && (
          <section>
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-headline font-bold text-xl uppercase tracking-tight text-ink">Recent Redemptions</h3>
            </div>
            <div className="space-y-3">
              {data?.recentRedemptions.map((r) => (
                <div key={r._id} className="bg-surface-container-lowest editorial-shadow p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-body font-bold text-sm text-ink capitalize">{r.status}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{formatDate(r.generatedAt)}</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-green-600">+₹{r.cashbackAmount}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Logout */}
      </main>

      <BottomNav />
    </div>
  );
}
