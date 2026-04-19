'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { dealApi, redemptionApi } from '@/lib/api';

interface DealDetail {
  _id: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: number;
  cashbackAmount: number;
  category: string;
  validFrom: unknown;
  validUntil: unknown;
  totalQuantity?: number;
  redeemedCount: number;
  termsAndConditions?: string;
  vendor?: {
    _id: string;
    businessName: string;
    address: string;
    category: string;
    rating: number;
    phone?: string;
    logoUrl?: string;
  };
}

function discountLabel(deal: DealDetail) {
  if (deal.discountType === 'percentage') return `${deal.discountValue}% OFF on ${deal.title}`;
  if (deal.discountType === 'flat') return `₹${deal.discountValue} OFF on ${deal.title}`;
  if (deal.discountType === 'bogo') return `Buy 1 Get 1 — ${deal.title}`;
  return deal.title;
}

function formatDate(ts: unknown) {
  if (!ts) return '—';
  try {
    const d = (ts as { toDate?: () => Date }).toDate ? (ts as { toDate: () => Date }).toDate() : new Date(ts as string);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

export default function DealDetailPage() {
  const { token, loading, firebaseUser } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ qrToken?: string; message?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await dealApi.getDealById(token || '', id) as { data: DealDetail };
        setDeal(res.data);
      } catch {
        setError('Deal not found.');
      } finally {
        setFetching(false);
      }
    })();
  }, [id]);

  const handleRedeem = async () => {
    if (!token) return;
    setRedeeming(true);
    setError('');
    try {
      const res = await redemptionApi.redeemDeal(token, id) as { data: { qrToken: string }; message: string };
      setRedeemResult({ qrToken: res.data?.qrToken, message: res.message });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to redeem deal.');
    } finally {
      setRedeeming(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center">
        <div className="font-headline font-black text-4xl tracking-tighter text-ink animate-pulse">STUDEX</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] flex flex-col items-center justify-center px-6">
        <span className="material-symbols-outlined text-6xl text-muted">error</span>
        <p className="font-headline font-bold text-2xl uppercase mt-4 text-ink">Deal Not Found</p>
        <button onClick={() => router.back()} className="mt-6 bg-ink text-white px-6 py-3 rounded-full font-headline uppercase tracking-widest text-sm snappy">
          Go Back
        </button>
      </div>
    );
  }

  const remaining = deal.totalQuantity != null ? deal.totalQuantity - deal.redeemedCount : null;

  return (
    <div className="min-h-screen bg-[#F7F4EF] font-body text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F7F4EF] px-6 py-6 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-12 h-12 bg-surface-container-lowest rounded-full editorial-shadow active:scale-95 snappy"
        >
          <span className="material-symbols-outlined text-ink">arrow_back</span>
        </button>
        <span className="font-headline font-black text-xl tracking-tighter uppercase text-ink">StudEX</span>
        <div className="w-12 h-12 flex items-center justify-center">
          <span className="material-symbols-outlined text-ink">share</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-36">
        {/* Amber pattern banner */}
        <section className="relative w-full h-48 rounded-3xl overflow-hidden pattern-amber mb-8 editorial-shadow">
          <div className="absolute inset-0 bg-black/10" />
          {deal.vendor?.logoUrl && (
            <img src={deal.vendor.logoUrl} alt={deal.vendor.businessName} className="w-full h-full object-cover" />
          )}
          <div className="absolute bottom-4 left-4">
            <span className="bg-terracotta text-white font-mono text-sm font-bold px-3 py-1.5 rounded">
              {deal.discountType === 'percentage' ? `${deal.discountValue}% OFF` :
               deal.discountType === 'flat' ? `₹${deal.discountValue} OFF` :
               deal.discountType?.toUpperCase()}
            </span>
          </div>
        </section>

        {/* Merchant Info */}
        <section className="mb-10">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="bg-ink text-white font-mono text-[10px] px-3 py-1 uppercase tracking-widest capitalize">
              {deal.vendor?.category || deal.category}
            </span>
            {deal.vendor && (
              <span className="text-green-600 font-bold text-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Verified
              </span>
            )}
          </div>
          <h1 className="font-headline font-bold text-[32px] leading-tight text-ink mb-2">
            {deal.vendor?.businessName || deal.title}
          </h1>
          {deal.vendor?.address && (
            <div className="flex items-center text-muted font-mono text-sm">
              <span className="material-symbols-outlined text-[18px] mr-1">location_on</span>
              {deal.vendor.address}
            </div>
          )}
          {deal.description && (
            <p className="mt-4 font-body text-on-surface-variant text-sm leading-relaxed">
              {deal.description}
            </p>
          )}
        </section>

        {/* Error / Success */}
        {error && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-sm font-body">
            {error}
          </div>
        )}
        {redeemResult && (
          <div className="mb-6 p-6 bg-charcoal text-white rounded-2xl space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-amber">Deal Activated!</p>
            <p className="font-body text-sm">{redeemResult.message}</p>
            {redeemResult.qrToken && (
              <div className="border-t border-white/20 pt-3">
                <p className="font-mono text-xs uppercase tracking-widest text-white/60 mb-1">Your Code</p>
                <p className="font-mono text-2xl font-bold text-amber tracking-widest">{redeemResult.qrToken}</p>
              </div>
            )}
          </div>
        )}

        {/* Offer Card — Voucher Style */}
        <section className="bg-surface-container-lowest p-8 rounded-3xl editorial-shadow mb-10 relative overflow-hidden">
          <div className="voucher-hole-left" />
          <div className="voucher-hole-right" />
          <div className="relative z-10">
            <p className="font-mono text-xs uppercase tracking-widest text-muted mb-4">Exclusive Deal</p>
            <h2 className="font-headline font-extrabold text-[28px] text-amber leading-tight uppercase mb-6">
              {discountLabel(deal)}
            </h2>
            {deal.cashbackAmount > 0 && (
              <p className="font-body text-green-600 font-bold text-sm mb-4">
                + ₹{deal.cashbackAmount} cashback on redemption
              </p>
            )}
            <div className="border-t border-dashed border-outline-variant pt-6 flex justify-between items-start">
              <div>
                <p className="font-mono text-[10px] uppercase text-muted">Valid Until</p>
                <p className="font-mono text-sm text-ink">{formatDate(deal.validUntil)}</p>
              </div>
              {remaining != null && (
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase text-muted">Remaining</p>
                  <p className="font-mono text-sm text-ink">{remaining} Left</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* How to Claim */}
        <section className="mb-12">
          <h3 className="font-headline font-bold text-xl uppercase mb-6 tracking-tight text-ink">How to Claim</h3>
          <div className="space-y-8">
            {[
              { n: '01', title: 'Activate the Deal', desc: 'Tap the Claim button below to generate your unique student voucher code.' },
              { n: '02', title: 'Show Student ID', desc: 'Present your valid student ID at the counter before ordering.' },
              { n: '03', title: 'Scan & Enjoy', desc: 'Let the vendor scan your code and apply the discount instantly.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-6 pl-6 border-l-4 border-amber">
                <div className="flex-shrink-0 font-headline font-black text-3xl text-ink opacity-20">{n}</div>
                <div>
                  <p className="font-body font-bold text-lg mb-1 text-ink">{title}</p>
                  <p className="text-muted text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Terms */}
        {deal.termsAndConditions && (
          <section className="p-6 bg-surface-container-high rounded-2xl mb-12">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-muted text-[20px]">info</span>
              <p className="text-xs text-muted leading-normal font-body">{deal.termsAndConditions}</p>
            </div>
          </section>
        )}

        {/* Vendor Rating */}
        {deal.vendor && deal.vendor.rating > 0 && (
          <div className="flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-amber text-sm">star</span>
            <span className="font-mono text-sm font-bold">{deal.vendor.rating.toFixed(1)}</span>
            <span className="font-body text-sm text-muted">({deal.vendor.businessName})</span>
          </div>
        )}
      </main>

      {/* Fixed CTA */}
      <footer className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#F7F4EF] via-[#F7F4EF]/90 to-transparent z-40">
        <div className="max-w-2xl mx-auto">
          {!redeemResult ? (
            <button
              onClick={handleRedeem}
              disabled={redeeming}
              className="w-full bg-ink text-white py-5 rounded-full font-headline font-bold text-lg uppercase tracking-wider active:scale-95 snappy editorial-shadow hover:bg-charcoal disabled:opacity-50"
            >
              {redeeming ? 'Claiming…' : 'Claim This Deal'}
            </button>
          ) : (
            <button
              onClick={() => router.push('/deals')}
              className="w-full bg-surface-container-lowest border border-outline-variant text-ink py-5 rounded-full font-headline font-bold text-lg uppercase tracking-wider snappy editorial-shadow"
            >
              Browse More Deals
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
