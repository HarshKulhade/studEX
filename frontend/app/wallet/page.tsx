'use client';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { walletApi } from '@/lib/api';
import BottomNav from '@/components/BottomNav';

interface WalletData {
  walletId: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  upiId?: string;
}

interface Transaction {
  _id: string;
  type: 'credit' | 'debit';
  amount: number;
  source: string;
  description: string;
  createdAt: unknown;
}

interface PaginatedResponse {
  data: Transaction[];
  pagination: { page: number; total: number; limit: number };
}

function formatDate(ts: unknown) {
  if (!ts) return '';
  try {
    let d: Date;
    if ((ts as any).toDate) {
      d = (ts as any).toDate();
    } else if (typeof ts === 'object' && ts !== null && '_seconds' in ts) {
      d = new Date((ts as any)._seconds * 1000);
    } else {
      d = new Date(ts as string | number);
    }
    if (isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${datePart} · ${timePart}`;
  } catch {
    return '';
  }
}

const SOURCE_LABELS: Record<string, string> = {
  deal_redemption: 'Deal Redemption',
  referral: 'Referral Bonus',
  print_job: 'Print Cashback',
  withdrawal: 'Withdrawal',
  wallet_topup: 'Wallet Top-Up',
};

// ── Success Animation Component ────────────────────────────────────────
function PaymentSuccessOverlay({ amount, onDone }: { amount: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl p-8 mx-6 max-w-sm w-full text-center animate-scaleIn editorial-shadow">
        {/* Animated checkmark */}
        <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-green-100 flex items-center justify-center animate-bounceIn">
          <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" className="animate-checkDraw" style={{ strokeDasharray: 24, strokeDashoffset: 24 }} />
          </svg>
        </div>
        <h3 className="font-headline font-black text-2xl uppercase tracking-tight text-ink">Payment Successful!</h3>
        <p className="font-mono text-4xl font-bold text-green-600 mt-3">+₹{amount}</p>
        <p className="font-body text-sm text-on-surface-variant mt-2">Added to your StudEX wallet</p>
        <div className="mt-5 flex gap-2 justify-center">
          <span className="w-2 h-2 rounded-full bg-amber animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-amber animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-amber animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes bounceIn { 0% { transform: scale(0); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes checkDraw { to { stroke-dashoffset: 0; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-bounceIn { animation: bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both; }
        .animate-checkDraw { animation: checkDraw 0.5s ease-out 0.5s forwards; }
      `}</style>
    </div>
  );
}

function WalletPageContent() {
  const { token, loading, firebaseUser, walletBalance, refreshWallet } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [topupMsg, setTopupMsg] = useState('');
  const [topupError, setTopupError] = useState('');
  const [showTopup, setShowTopup] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState('');
  const pendingOrderRef = useRef<{ order_id: string; amount: string } | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [firebaseUser, loading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [wRes, tRes] = await Promise.all([
        walletApi.getWallet(token) as Promise<{ data: WalletData }>,
        walletApi.getTransactions(token) as Promise<PaginatedResponse>,
      ]);
      setWallet(wRes.data);
      setTxns(tRes.data || []);
      // Sync global context balance with the freshest value from API
      await refreshWallet();
    } catch {
      // silently fail
    } finally {
      setFetching(false);
    }
  }, [token, refreshWallet]);

  useEffect(() => { load(); }, [load]);

  // ── Handle redirect-back from Cashfree (UPI/netbanking redirect flows) ──
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (!orderId || !token) return;

    // Clean URL immediately
    const url = new URL(window.location.href);
    url.searchParams.delete('order_id');
    window.history.replaceState({}, '', url.pathname);

    // Verify the payment
    const verifyRedirectPayment = async () => {
      setToppingUp(true);
      setTopupMsg('Verifying your payment...');
      try {
        await walletApi.verifyCashfreePayment(token, { order_id: orderId });
        setTopupMsg('');
        setSuccessAmount(pendingOrderRef.current?.amount || '');
        setShowSuccess(true);
        setShowTopup(false);
        setTopupAmount('');
        await load();
      } catch {
        // Payment might still be processing or failed — just refresh
        setTopupMsg('');
        await load();
      } finally {
        setToppingUp(false);
        pendingOrderRef.current = null;
      }
    };

    verifyRedirectPayment();
  }, [searchParams, token, load]);

  const loadCashfreeScript = () => new Promise<void>((resolve, reject) => {
    if ((window as any).Cashfree) return resolve();
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK.'));
    document.body.appendChild(script);
  });

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setTopupError('');
    setTopupMsg('');
    setToppingUp(true);
    try {
      setTopupMsg('Initializing secure payment gateway...');

      await loadCashfreeScript();

      // 1. Create order on backend
      const res = await walletApi.createCashfreeOrder(token, { amount: parseFloat(topupAmount) }) as {
        data: { order: { order_id: string; payment_session_id: string; payment_mode: string } }
      };
      const order = res.data.order;

      // Store order details in case of redirect
      pendingOrderRef.current = { order_id: order.order_id, amount: topupAmount };

      // 2. Initialize Cashfree checkout (mode comes from backend to avoid env mismatch)
      const cashfree = await (window as any).Cashfree({
        mode: order.payment_mode || 'production',
      });

      setTopupMsg('Opening payment window...');

      const checkoutOptions = {
        paymentSessionId: order.payment_session_id,
        redirectTarget: '_modal',
      };

      // 3. Open checkout
      const result = await cashfree.checkout(checkoutOptions);

      // 4. Handle result (fires for modal-based payments like cards)
      if (result.error) {
        // Payment was cancelled or failed in modal
        setTopupError(result.error.message || 'Payment was cancelled.');
        setToppingUp(false);
        setTopupMsg('');
        return;
      }

      // Payment completed (or redirect happened) — verify on backend
      setTopupMsg('Verifying payment...');
      try {
        await walletApi.verifyCashfreePayment(token, { order_id: order.order_id });
        // Show success animation
        setTopupMsg('');
        setTopupError('');
        setSuccessAmount(topupAmount);
        setShowSuccess(true);
        setShowTopup(false);
        setTopupAmount('');
        await load();
      } catch (verifyErr: any) {
        setTopupError(verifyErr.message || 'Payment verification failed. If money was debited, it will be refunded.');
      } finally {
        setToppingUp(false);
        pendingOrderRef.current = null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize payment gateway.';
      // Don't show error if user just dismissed the modal
      if (!msg.includes('popup closed') && !msg.includes('user cancelled')) {
        setTopupError(msg);
      }
      setToppingUp(false);
      setTopupMsg('');
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center">
        <div className="font-headline font-black text-4xl tracking-tighter text-ink animate-pulse">STUDEX</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EF] pb-28">
      {/* Success Animation Overlay */}
      {showSuccess && (
        <PaymentSuccessOverlay
          amount={successAmount}
          onDone={() => setShowSuccess(false)}
        />
      )}

      {/* Header */}
      <header className="bg-[#F7F4EF] sticky top-0 z-40 flex justify-between items-center px-6 py-4">
        <button onClick={() => router.back()} className="text-ink">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="font-headline font-black text-2xl tracking-tighter text-ink uppercase">Wallet</span>
        <button onClick={load} className="text-muted hover:text-ink snappy">
          <span className="material-symbols-outlined text-xl">refresh</span>
        </button>
      </header>

      <main className="px-6 space-y-8 mt-2">
        {/* Balance Card */}
        <section className="bg-charcoal text-white p-8 rounded-3xl relative overflow-hidden editorial-shadow">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber rotate-45 translate-x-14 -translate-y-14 opacity-80" />
          <div className="relative z-10">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber">Personal Wallet Balance</span>
            <div className="mt-3 mb-4">
              <span className="font-mono text-6xl font-bold">₹{walletBalance.toFixed(2)}</span>
            </div>
            <div className="flex gap-8 border-t border-white/20 pt-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/60">Total Added</p>
                <p className="font-mono text-lg font-bold">₹{(wallet?.totalEarned ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/60">Total Spent</p>
                <p className="font-mono text-lg font-bold">₹{(wallet?.totalWithdrawn ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Add Funds */}
        <section className="bg-surface-container-lowest editorial-shadow p-6 rounded-2xl space-y-4">
          <h2 className="font-headline font-bold text-xl uppercase tracking-tight text-ink">Top Up Wallet</h2>

          {topupMsg && (
            <div className="bg-amber/10 border border-amber/30 rounded-xl p-3 font-body text-sm text-ink flex items-center gap-2">
              <span className="material-symbols-outlined text-amber text-lg animate-spin">progress_activity</span>
              {topupMsg}
            </div>
          )}
          {topupError && (
            <div className="bg-error-container border border-tertiary/20 rounded-xl p-3 font-body text-sm text-tertiary">{topupError}</div>
          )}

          {!showTopup ? (
            <button
              onClick={() => setShowTopup(true)}
              className="w-full flex items-center justify-center gap-2 p-4 bg-ink text-white rounded-xl font-headline font-bold text-sm uppercase tracking-wider snappy hover:bg-charcoal editorial-shadow"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Add Money
            </button>
          ) : (
            <form onSubmit={handleAddMoney} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">Enter Amount (₹)</label>
                <input
                  type="number"
                  min="10"
                  step="1"
                  value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)}
                  placeholder="₹ 100"
                  className="w-full px-4 py-4 bg-surface-container-high rounded-xl font-mono text-2xl text-ink outline-none focus:ring-2 focus:ring-amber"
                  required
                  disabled={toppingUp}
                />
              </div>
              <div className="flex gap-2">
                {[100, 200, 500, 1000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    disabled={toppingUp}
                    onClick={() => setTopupAmount(String(amt))}
                    className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold snappy ${topupAmount === String(amt) ? 'bg-amber text-ink' : 'bg-surface-container-high text-muted hover:bg-amber/20'} disabled:opacity-50`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={toppingUp}
                  onClick={() => { setShowTopup(false); setTopupAmount(''); setTopupError(''); setTopupMsg(''); }}
                  className="flex-1 py-4 rounded-xl font-headline font-bold text-sm uppercase tracking-wider bg-surface-container-high text-muted snappy hover:bg-surface-container-highest disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={toppingUp || !topupAmount || parseFloat(topupAmount) < 10}
                  className="flex-[2] py-4 rounded-xl font-headline font-bold text-sm uppercase tracking-wider bg-ink text-white snappy hover:bg-charcoal editorial-shadow disabled:opacity-50"
                >
                  {toppingUp ? 'Processing...' : `Pay ₹${topupAmount || '0'}`}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Transaction History */}
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="font-headline font-bold text-xl uppercase tracking-tight text-ink">Transaction History</h2>
            <span className="font-mono text-xs text-muted uppercase">{txns.length} total</span>
          </div>
          {txns.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-muted">receipt_long</span>
              <p className="font-body text-on-surface-variant mt-3">No transactions yet. Start redeeming deals!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {txns.map((t) => (
                <div key={t._id} className="bg-surface-container-lowest editorial-shadow p-5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'credit' ? 'bg-green-100' : 'bg-error-container'}`}>
                      <span className="material-symbols-outlined text-sm" style={{ color: t.type === 'credit' ? '#15803d' : '#ba1a1a' }}>
                        {t.type === 'credit' ? 'add' : 'remove'}
                      </span>
                    </div>
                    <div>
                      <p className="font-body font-bold text-sm text-ink">{SOURCE_LABELS[t.source] || t.source}</p>
                      {t.description && (
                        <p className="font-body text-xs text-on-surface-variant mt-0.5 max-w-[180px] truncate">{t.description}</p>
                      )}
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-0.5">{formatDate(t.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-base font-bold ${t.type === 'credit' ? 'text-green-600' : 'text-tertiary'}`}>
                    {t.type === 'credit' ? '+' : '-'}₹{t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center">
        <div className="font-headline font-black text-4xl tracking-tighter text-ink animate-pulse">STUDEX</div>
      </div>
    }>
      <WalletPageContent />
    </Suspense>
  );
}
