'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

export default function WalletPage() {
  const { token, loading, firebaseUser, walletBalance, refreshWallet } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [topupMsg, setTopupMsg] = useState('');
  const [topupError, setTopupError] = useState('');
  const [showTopup, setShowTopup] = useState(false);

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

  const loadRazorpayScript = () => new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK.'));
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
      
      await loadRazorpayScript();

      // 1. Create order
      const res = await walletApi.createRazorpayOrder(token, { amount: parseFloat(topupAmount) }) as { data: { order: any } };
      const order = res.data.order;

      // 2. Configure checkout
      const options = {
        key: 'rzp_test_SepIrqG3GFUyNo', // In production, move to NEXT_PUBLIC_RAZORPAY_KEY vars
        amount: order.amount,
        currency: order.currency,
        name: 'StudEX',
        description: 'Wallet Top Up',
        order_id: order.id,
        handler: async function (response: any) {
          try {
            setTopupMsg('Verifying payment...');
            await walletApi.verifyRazorpayPayment(token, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: parseFloat(topupAmount)
            });
            setTopupMsg(`Payment successful! ₹${topupAmount} added to your personal wallet.`);
            setTopupAmount('');
            setShowTopup(false);
            await load(); // refreshes transactions + updates global walletBalance
          } catch (err: any) {
            setTopupError(err.message || 'Payment verification failed');
          } finally {
            setToppingUp(false);
          }
        },
        prefill: {
          name: firebaseUser?.displayName || 'Student',
          email: firebaseUser?.email || '',
        },
        theme: {
          color: '#e8a020',
        },
        modal: {
          ondismiss: function() {
            setToppingUp(false);
            setTopupMsg('');
          }
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.on('payment.failed', function (response: any) {
        setTopupError(response.error.description || 'Payment Failed');
        setToppingUp(false);
      });
      
      razorpay.open();
    } catch (err: unknown) {
      setTopupError(err instanceof Error ? err.message : 'Failed to initialize payment gateway.');
      setToppingUp(false);
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

          <button
            onClick={() => setShowTopup((p) => !p)}
            className="w-full flex items-center justify-between p-4 bg-surface-container-high rounded-xl font-body font-bold text-sm text-ink snappy"
          >
            Add Money
            <span className="material-symbols-outlined text-muted">{showTopup ? 'expand_less' : 'expand_more'}</span>
          </button>

          {showTopup && (
            <form onSubmit={handleAddMoney} className="space-y-4 pt-2">
              {topupError && (
                <div className="p-3 bg-error-container text-on-error-container rounded-lg text-sm">{topupError}</div>
              )}
              {topupMsg && (
                <div className="p-3 bg-surface-container-high text-green-700 font-bold rounded-lg text-sm">{topupMsg}</div>
              )}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">Amount to add</label>
                <input
                  type="number"
                  min={10}
                  step={1}
                  required
                  placeholder="Enter amount (e.g. 500)"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="input-underline bg-surface-container-high"
                />
              </div>
              <button
                type="submit"
                disabled={toppingUp || !topupAmount}
                className="w-full bg-ink text-white py-4 rounded-full font-headline font-bold uppercase tracking-widest text-sm snappy hover:bg-charcoal disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {toppingUp ? 'Initializing…' : 'Proceed to Pay'} <span className="material-symbols-outlined text-base">payments</span>
              </button>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider text-center">
                Secure payments verified by Razorpay
              </p>
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
