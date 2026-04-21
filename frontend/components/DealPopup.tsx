'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { dealApi, redemptionApi, studentApi, walletApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
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
  shopName?: string;
  offer?: string;
  rating?: number;
  address?: string;
  googleMapsUrl?: string;
  coverImageUrl?: string;
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

interface DealPopupProps {
  dealId: string;
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   Claim Flow Steps
   ═══════════════════════════════════════════════════════════════ */
type ClaimStep =
  | 'idle'            // Normal deal view
  | 'unverified'      // Student not verified popup
  | 'enter-amount'    // Enter purchase amount
  | 'payment'         // QR scanner + wallet pay
  | 'processing'      // Processing payment
  | 'success';        // Transaction complete

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function discountLabel(deal: DealDetail) {
  if (deal.discountType === 'percentage') return `${deal.discountValue}% OFF`;
  if (deal.discountType === 'flat') return `₹${deal.discountValue} OFF`;
  if (deal.discountType === 'bogo') return 'B1G1';
  if (deal.offer) return deal.offer;
  return deal.title;
}

function discountDescription(deal: DealDetail) {
  if (deal.discountType === 'percentage') return `${deal.discountValue}% OFF on ${deal.title}`;
  if (deal.discountType === 'flat') return `₹${deal.discountValue} OFF on ${deal.title}`;
  if (deal.discountType === 'bogo') return `Buy 1 Get 1 — ${deal.title}`;
  return deal.title;
}

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

function shopName(deal: DealDetail): string {
  return deal.shopName || deal.vendor?.businessName || deal.title;
}

/** Calculate discount based on deal type + input amount */
function calculateDiscount(deal: DealDetail, amount: number): { discount: number; finalAmount: number; eligible: boolean; reason: string } {
  if (amount <= 0) return { discount: 0, finalAmount: 0, eligible: false, reason: 'Enter a valid amount' };

  if (deal.discountType === 'percentage') {
    // E.g. "10% off above ₹99"
    const minAmount = deal.discountValue > 0 ? 99 : 0; // common minimum
    if (amount < minAmount) {
      return {
        discount: 0,
        finalAmount: amount,
        eligible: false,
        reason: `Minimum order ₹${minAmount} required for ${deal.discountValue}% off`,
      };
    }
    const disc = Math.round((amount * deal.discountValue) / 100);
    // Cap at maxDiscount if present — but since we don't have that field exposed here 
    // we just apply the raw percentage
    return { discount: disc, finalAmount: amount - disc, eligible: true, reason: '' };
  }

  if (deal.discountType === 'flat') {
    if (amount < deal.discountValue) {
      return { discount: 0, finalAmount: amount, eligible: false, reason: `Minimum order ₹${deal.discountValue} required` };
    }
    return { discount: deal.discountValue, finalAmount: amount - deal.discountValue, eligible: true, reason: '' };
  }

  if (deal.discountType === 'bogo') {
    return { discount: 0, finalAmount: amount, eligible: true, reason: 'Buy 1 Get 1 — discount applied at counter' };
  }

  return { discount: 0, finalAmount: amount, eligible: true, reason: '' };
}

const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant',
  fashion: 'checkroom',
  electronics: 'devices',
  fitness: 'fitness_center',
  entertainment: 'movie',
  education: 'school',
  beauty: 'spa',
  travel: 'flight',
  other: 'local_offer',
};

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function DealPopup({ dealId, onClose }: DealPopupProps) {
  const { token, student, walletBalance, refreshWallet } = useAuth();
  const router = useRouter();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // Claim flow state
  const [claimStep, setClaimStep] = useState<ClaimStep>('idle');
  const [orderAmount, setOrderAmount] = useState('');
  const [payingWithWallet, setPayingWithWallet] = useState(false);
  const [scanningQR, setScanningQR] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{
    qrToken?: string;
    qrImageBase64?: string;
    message?: string;
    cashbackAmount?: number;
  } | null>(null);
  const [claimError, setClaimError] = useState('');
  const [destinationCode, setDestinationCode] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  // QR scanner video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Slide-in animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Fetch deal detail
  useEffect(() => {
    if (!dealId) return;
    (async () => {
      try {
        const res = await dealApi.getDealById(token || '', dealId) as { data: DealDetail };
        setDeal(res.data);
      } catch {
        setError('Could not load deal details.');
      } finally {
        setFetching(false);
      }
    })();
  }, [dealId, token]);

  // Close with slide-out animation
  const handleClose = useCallback(() => {
    stopCamera();
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  // Backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).id === 'deal-popup-backdrop') handleClose();
    },
    [handleClose],
  );

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  /* ─── Camera / QR scanning ─── */
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Start scanning frames for QR code
      scanIntervalRef.current = setInterval(() => {
        scanFrame();
      }, 500);
    } catch {
      setClaimError('Camera access denied. Please allow camera to scan QR code.');
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Use BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      detector.detect(imageData).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          handleQRDetected(barcodes[0].rawValue);
        }
      }).catch(() => { /* silently fail */ });
    }
    // Fallback: we'll also let users enter code manually
  };

  const handleQRDetected = async (qrData: string) => {
    if (claimStep !== 'payment') return;
    stopCamera();
    setScanningQR(false);
    setDestinationCode(qrData);
  };

  /* ─── Claim Flow Logic ─── */

  /** Step 1: Check verification when user taps "Claim" */
  const handleClaimClick = async () => {
    setClaimError('');

    // Check verification from context first, then fetch fresh profile
    let verified = student?.isVerified || student?.verificationStatus === 'verified';

    if (!verified && token) {
      try {
        const res = await studentApi.getProfile(token) as { data: { isVerified: boolean; verificationStatus: string } };
        verified = res.data.isVerified || res.data.verificationStatus === 'verified';
        setVerificationStatus(res.data.verificationStatus);
      } catch {
        // If we can't fetch, fall back to context
      }
    }

    if (!verified) {
      setClaimStep('unverified');
      setVerificationStatus(student?.verificationStatus || 'unverified');
      return;
    }

    // Student is verified → go to amount entry
    setClaimStep('enter-amount');
  };

  /** Step 2: Calculate discount and proceed to payment */
  const handleProceedToPayment = () => {
    if (!deal) return;
    const amount = parseFloat(orderAmount);
    if (isNaN(amount) || amount <= 0) {
      setClaimError('Please enter a valid amount.');
      return;
    }

    const { eligible, reason } = calculateDiscount(deal, amount);
    if (!eligible && reason) {
      setClaimError(reason);
      return;
    }

    setClaimError('');
    setDestinationCode('');
    setClaimStep('payment');
    // Also refresh wallet balance
    if (token) refreshWallet();
  };

  /** Step 3: Process redemption (after QR scan or wallet pay) */
  const processRedemption = async (qrData?: string) => {
    if (!token || !deal) return;
    setClaimError('');
    try {
      const res = await redemptionApi.redeemDeal(token, dealId) as {
        data: { qrToken: string; qrImageBase64?: string; cashbackAmount?: number };
        message: string;
      };
      setRedeemResult({
        qrToken: res.data?.qrToken,
        qrImageBase64: res.data?.qrImageBase64,
        message: res.message,
        cashbackAmount: res.data?.cashbackAmount,
      });
      setClaimStep('success');
      // Refresh wallet to show updated balance
      await refreshWallet();
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : 'Failed to redeem deal.');
      setClaimStep('payment');
    }
  };

  /** Pay from wallet */
  const handleWalletPay = async () => {
    if (!deal || !token) return;
    const amount = parseFloat(orderAmount);
    const { finalAmount } = calculateDiscount(deal, amount);

    if (walletBalance < finalAmount) {
      setClaimError(`Insufficient wallet balance. You have ₹${walletBalance.toFixed(2)} but need ₹${finalAmount.toFixed(2)}.`);
      return;
    }

    setPayingWithWallet(true);
    setClaimStep('processing');

    try {
      // Deduct from wallet
      await walletApi.withdraw(token, {
        amount: finalAmount,
        upiId: 'studex-deal@wallet', // Internal wallet payment marker
      });

      // Then process the redemption
      await processRedemption();
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : 'Wallet payment failed.');
      setClaimStep('payment');
    } finally {
      setPayingWithWallet(false);
    }
  };

  /** Start QR scanner */
  const handleStartScan = () => {
    setScanningQR(true);
    startCamera();
  };

  /** Manual code entry after QR scan */
  const [manualCode, setManualCode] = useState('');
  const handleManualCodeSubmit = async () => {
    if (!manualCode.trim()) {
      setClaimError('Please enter the vendor code.');
      return;
    }
    setDestinationCode(manualCode.trim());
  };

  /* ─── Computed values ─── */
  const name = deal ? shopName(deal) : '';
  const categoryIcon = deal ? (CATEGORY_ICONS[deal.category] || 'local_offer') : 'local_offer';
  const rating = deal ? (deal.rating ?? deal.vendor?.rating ?? 0) : 0;
  const remaining = deal && deal.totalQuantity != null ? deal.totalQuantity - deal.redeemedCount : null;

  const parsedAmount = parseFloat(orderAmount) || 0;
  const discountCalc = deal ? calculateDiscount(deal, parsedAmount) : { discount: 0, finalAmount: 0, eligible: false, reason: '' };

  const handleShare = async () => {
    if (!deal) return;
    const text = `Check out this deal on StudEX: ${discountDescription(deal)} at ${shopName(deal)}!`;
    if (navigator.share) {
      try { await navigator.share({ title: shopName(deal), text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div
      id="deal-popup-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ backgroundColor: visible ? 'rgba(26,26,24,0.55)' : 'transparent', transition: 'background-color 250ms ease-out' }}
    >
      <div
        className="relative w-full max-w-lg bg-[#F7F4EF] overflow-hidden flex flex-col"
        style={{
          maxHeight: '92dvh',
          borderRadius: '24px 24px 0 0',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-outline-variant/60" />
        </div>

        {/* Top App Bar */}
        <header className="flex justify-between items-center px-6 py-3 flex-shrink-0">
          <button onClick={handleClose} className="active:scale-95 snappy hover:opacity-80 text-ink" aria-label="Close">
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
          <h1 className="font-headline font-bold tracking-tight text-ink text-base uppercase truncate max-w-[200px]">
            {fetching ? '…' : name}
          </h1>
          <button onClick={handleShare} className="active:scale-95 snappy hover:opacity-80 text-ink relative" aria-label="Share">
            <span className="material-symbols-outlined text-[24px]">share</span>
          </button>
        </header>

        {/* Share toast */}
        {shareToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-ink text-white font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-full snappy">
            Copied to clipboard
          </div>
        )}

        {/* ═══ Scrollable Content ═══ */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
          {fetching ? (
            <div className="px-6 py-8 space-y-6 animate-pulse">
              <div className="w-full h-48 bg-surface-container-high rounded-sm" />
              <div className="bg-surface-container-lowest p-6">
                <div className="h-8 bg-surface-container-high rounded w-3/4 mb-3" />
                <div className="h-4 bg-surface-container-high rounded w-1/2" />
              </div>
              <div className="h-40 bg-surface-container-high rounded-sm" />
            </div>
          ) : !deal ? (
            <div className="px-6 py-16 text-center">
              <span className="material-symbols-outlined text-6xl text-muted">error</span>
              <p className="font-headline font-bold text-2xl uppercase mt-4 text-ink">Deal Not Found</p>
              <p className="font-body text-sm text-muted mt-2">{error}</p>
            </div>
          ) : (
            <>
              {/* ── Merchant Header ── */}
              <section className="px-0">
                <div className="w-full aspect-[4/3] overflow-hidden relative">
                  {deal.coverImageUrl ? (
                    <img alt={name} className="w-full h-full object-cover" src={deal.coverImageUrl} />
                  ) : deal.vendor?.logoUrl ? (
                    <img alt={name} className="w-full h-full object-cover" src={deal.vendor.logoUrl} />
                  ) : (
                    <div className="w-full h-full pattern-amber flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/5" />
                      <span className="font-headline font-black text-[120px] text-white/20 select-none uppercase leading-none">
                        {name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-terracotta text-white font-mono text-sm font-bold px-3 py-1.5">
                      {discountLabel(deal)}
                    </span>
                  </div>
                </div>

                <div className="px-6 -mt-8 relative z-10">
                  <div className="bg-surface-container-lowest p-6 editorial-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="font-headline font-semibold text-[28px] leading-tight text-ink pr-3">{name}</h2>
                      {rating > 0 && (
                        <div className="flex items-center space-x-1 bg-surface-container-high px-2 py-1 rounded-sm flex-shrink-0">
                          <span className="material-symbols-outlined text-amber text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span className="font-mono text-sm font-medium">{rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {deal.vendor && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#2D4C3B] text-white text-[10px] font-bold tracking-widest uppercase rounded-full">
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          Verified
                        </span>
                      )}
                      <span className="text-on-surface-variant font-mono text-[11px] uppercase tracking-tighter capitalize">
                        {deal.vendor?.category || deal.category}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Exclusive Offer — Voucher Ticket ── */}
              <section className="mt-10 px-6">
                <div className="flex items-end justify-between mb-4">
                  <h3 className="font-headline font-medium text-xl uppercase tracking-tight">Exclusive Offer</h3>
                  <span className="font-mono text-[10px] text-primary border-b border-primary uppercase">Student Deal</span>
                </div>

                <div className="bg-surface-container-lowest p-6 editorial-shadow relative overflow-hidden">
                  <div className="voucher-hole-left" />
                  <div className="voucher-hole-right" />
                  <div className="relative z-10">
                    <div className="mb-6 h-10 w-10 flex items-center justify-center bg-primary-container text-on-primary-container rounded-sm">
                      <span className="material-symbols-outlined">{categoryIcon}</span>
                    </div>
                    <h4 className="font-headline font-bold text-3xl mb-1 text-ink">{discountLabel(deal)}</h4>
                    <p className="font-body text-sm text-on-surface-variant uppercase tracking-wide mb-1">{deal.title}</p>
                    {deal.description && (
                      <p className="font-body text-sm text-on-surface-variant leading-relaxed mt-2">{deal.description}</p>
                    )}
                    {deal.cashbackAmount > 0 && (
                      <p className="font-body text-green-600 font-bold text-sm mt-3">+ ₹{deal.cashbackAmount} cashback on redemption</p>
                    )}
                    <div className="mt-6 pt-4 border-t border-dashed border-outline-variant flex justify-between items-center">
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
                </div>
              </section>

              {/* ════════════════════════════════════════════════════════
                 CLAIM FLOW OVERLAYS
                 ════════════════════════════════════════════════════════ */}

              {/* ── Unverified Student Popup ── */}
              {claimStep === 'unverified' && (
                <section className="mx-6 mt-8">
                  <div className="bg-surface-container-lowest p-6 editorial-shadow relative overflow-hidden">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-error-container rounded-sm">
                        <span className="material-symbols-outlined text-tertiary text-[24px]">shield_person</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-headline font-bold text-lg text-ink uppercase tracking-tight mb-2">
                          Verification Required
                        </h4>
                        <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                          Please verify you are a student to claim this deal. Upload your college ID in your profile to get verified.
                        </p>
                        {verificationStatus === 'pending' && (
                          <div className="mt-3 p-3 bg-amber/10 rounded-sm">
                            <p className="font-mono text-xs text-amber font-bold uppercase tracking-wider">
                              ⏳ Your verification is pending review
                            </p>
                            <p className="font-body text-xs text-muted mt-1">
                              We&apos;ll notify you within 24–48 hours.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-dashed border-outline-variant space-y-3">
                      <button
                        onClick={() => router.push('/profile')}
                        className="w-full bg-ink text-white py-4 rounded-full font-headline font-bold text-sm tracking-[0.2em] uppercase active:scale-[0.98] snappy flex items-center justify-center gap-3"
                      >
                        <span className="material-symbols-outlined text-lg">badge</span>
                        Go to Profile
                      </button>
                      <button
                        onClick={() => setClaimStep('idle')}
                        className="w-full py-3 font-mono text-xs text-muted uppercase tracking-widest hover:text-ink snappy"
                      >
                        Back to Deal
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Enter Amount Step ── */}
              {claimStep === 'enter-amount' && (
                <section className="mx-6 mt-8">
                  <div className="bg-surface-container-lowest p-6 editorial-shadow">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-10 w-10 flex items-center justify-center bg-primary-container text-on-primary-container rounded-sm">
                        <span className="material-symbols-outlined">receipt_long</span>
                      </div>
                      <div>
                        <h4 className="font-headline font-bold text-lg text-ink uppercase tracking-tight">
                          Enter Order Amount
                        </h4>
                        <p className="font-mono text-[10px] text-muted uppercase tracking-wider">
                          Discount will be applied automatically
                        </p>
                      </div>
                    </div>

                    {/* Amount input */}
                    <div className="relative mb-4">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-2xl text-ink font-bold">₹</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="0"
                        value={orderAmount}
                        onChange={(e) => { setOrderAmount(e.target.value); setClaimError(''); }}
                        autoFocus
                        className="w-full bg-transparent border-b-2 border-outline-variant py-3 pl-8 font-mono text-3xl text-ink font-bold focus:outline-none focus:border-amber snappy placeholder:text-surface-container-high"
                      />
                    </div>

                    {/* Live discount calculator */}
                    {parsedAmount > 0 && (
                      <div className="bg-surface-container-high p-4 rounded-sm space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="font-body text-sm text-on-surface-variant">Order Amount</span>
                          <span className="font-mono text-sm text-ink">₹{parsedAmount.toFixed(2)}</span>
                        </div>
                        {discountCalc.eligible && discountCalc.discount > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="font-body text-sm text-green-600 font-bold">
                              {deal.discountType === 'percentage' ? `${deal.discountValue}% Discount` : `Flat ₹${deal.discountValue} Off`}
                            </span>
                            <span className="font-mono text-sm text-green-600 font-bold">- ₹{discountCalc.discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-dashed border-outline-variant pt-2 flex justify-between items-center">
                          <span className="font-headline font-bold text-sm text-ink uppercase">You Pay</span>
                          <span className="font-mono text-xl text-ink font-bold">₹{discountCalc.finalAmount.toFixed(2)}</span>
                        </div>
                        {deal.cashbackAmount > 0 && (
                          <p className="font-mono text-[10px] text-green-600 uppercase tracking-wider">
                            + ₹{deal.cashbackAmount} cashback after redemption
                          </p>
                        )}
                      </div>
                    )}

                    {!discountCalc.eligible && discountCalc.reason && parsedAmount > 0 && (
                      <p className="font-body text-xs text-terracotta mb-4">{discountCalc.reason}</p>
                    )}

                    {claimError && (
                      <div className="p-3 bg-error-container text-on-error-container rounded-sm text-sm font-body mb-4">{claimError}</div>
                    )}

                    <div className="space-y-3">
                      <button
                        onClick={handleProceedToPayment}
                        disabled={parsedAmount <= 0}
                        className="w-full bg-ink text-white py-4 rounded-full font-headline font-bold text-sm tracking-[0.2em] uppercase active:scale-[0.98] snappy flex items-center justify-center gap-3 disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        Proceed to Payment
                      </button>
                      <button
                        onClick={() => { setClaimStep('idle'); setClaimError(''); }}
                        className="w-full py-3 font-mono text-xs text-muted uppercase tracking-widest hover:text-ink snappy"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Payment Step — QR Scanner + Wallet ── */}
              {claimStep === 'payment' && (
                <section className="mx-6 mt-8">
                  <div className="bg-surface-container-lowest p-6 editorial-shadow space-y-6">
                    {/* Summary */}
                    <div className="flex items-center justify-between pb-4 border-b border-dashed border-outline-variant">
                      <div>
                        <p className="font-mono text-[10px] text-muted uppercase tracking-wider">Amount to Pay</p>
                        <p className="font-mono text-2xl text-ink font-bold">₹{discountCalc.finalAmount.toFixed(2)}</p>
                      </div>
                      {discountCalc.discount > 0 && (
                        <div className="text-right">
                          <p className="font-mono text-[10px] text-green-600 uppercase tracking-wider">You Save</p>
                          <p className="font-mono text-lg text-green-600 font-bold">₹{discountCalc.discount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>

                    {/* QR Scanner and Manual Entry OR Wallet Payment */}
                    {!destinationCode ? (
                      <>
                        {/* QR Scanner */}
                        <div>
                          <h4 className="font-headline font-bold text-sm text-ink uppercase tracking-tight mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                            Scan Shop QR Code
                          </h4>

                          {!scanningQR ? (
                            <button
                              onClick={handleStartScan}
                              className="w-full py-6 border-2 border-dashed border-outline-variant rounded-sm text-center hover:border-amber snappy flex flex-col items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-4xl text-muted">qr_code_scanner</span>
                              <span className="font-body font-bold text-sm text-ink">Tap to Open Camera</span>
                              <span className="font-mono text-[10px] text-muted uppercase tracking-wider">Scan the vendor&apos;s QR code</span>
                            </button>
                          ) : (
                            <div className="space-y-3">
                              <div className="relative w-full aspect-square bg-ink rounded-sm overflow-hidden">
                                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                                <canvas ref={canvasRef} className="hidden" />
                                {/* Scanner overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-48 h-48 border-2 border-amber rounded-sm relative">
                                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber" />
                                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber" />
                                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber" />
                                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber" />
                                  </div>
                                </div>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-1.5 rounded-full">
                                  <p className="font-mono text-xs uppercase tracking-wider">Scanning…</p>
                                </div>
                              </div>
                              <button
                                onClick={() => { stopCamera(); setScanningQR(false); }}
                                className="w-full py-2 font-mono text-xs text-muted uppercase tracking-widest hover:text-ink snappy"
                              >
                                Close Camera
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Manual Code Entry */}
                        <div>
                          <h4 className="font-headline font-bold text-sm text-ink uppercase tracking-tight mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">keyboard</span>
                            Or Enter Code Manually
                          </h4>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter vendor code"
                              value={manualCode}
                              onChange={(e) => setManualCode(e.target.value)}
                              className="flex-1 bg-surface-container-high px-4 py-3 font-mono text-sm text-ink rounded-sm focus:outline-none focus:ring-2 focus:ring-amber snappy placeholder:text-muted"
                            />
                            <button
                              onClick={handleManualCodeSubmit}
                              disabled={!manualCode.trim()}
                              className="px-4 py-3 bg-ink text-white font-headline font-bold text-xs uppercase tracking-wider rounded-sm snappy disabled:opacity-40"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-surface-container-high p-4 rounded-sm flex items-center justify-between mb-2">
                          <div>
                            <p className="font-mono text-[10px] uppercase text-muted mb-1">Destination Code</p>
                            <p className="font-mono text-lg font-bold text-ink">{destinationCode}</p>
                          </div>
                          <button onClick={() => setDestinationCode('')} className="text-terracotta text-xs font-mono uppercase tracking-widest hover:opacity-80 transition-opacity">Change</button>
                        </div>

                        {/* Wallet Pay */}
                        <div>
                          <h4 className="font-headline font-bold text-sm text-ink uppercase tracking-tight mb-3 flex items-center gap-2 mt-4">
                            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                            Pay from Wallet
                          </h4>
                          <div className="bg-charcoal text-white p-4 rounded-sm mb-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-wider text-amber">Wallet Balance</p>
                                <p className="font-mono text-2xl font-bold">₹{walletBalance.toFixed(2)}</p>
                              </div>
                              {walletBalance >= discountCalc.finalAmount ? (
                                <span className="material-symbols-outlined text-green-400 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              ) : (
                                <span className="material-symbols-outlined text-terracotta text-2xl">warning</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={handleWalletPay}
                            disabled={payingWithWallet || walletBalance < discountCalc.finalAmount}
                            className="w-full bg-amber text-ink py-4 rounded-full font-headline font-bold text-sm tracking-[0.2em] uppercase active:scale-[0.98] snappy flex items-center justify-center gap-3 disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-lg">payments</span>
                            {payingWithWallet ? 'Processing…' : `Pay ₹${discountCalc.finalAmount.toFixed(2)} from Wallet`}
                          </button>
                          {walletBalance < discountCalc.finalAmount && (
                            <button
                              onClick={() => router.push('/wallet')}
                              className="w-full mt-2 py-3 font-mono text-xs text-primary uppercase tracking-widest hover:text-ink snappy"
                            >
                              Top up wallet →
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 py-2 my-2">
                           <div className="flex-1 h-px bg-outline-variant/40" />
                           <span className="font-mono text-[10px] text-muted uppercase tracking-widest">or</span>
                           <div className="flex-1 h-px bg-outline-variant/40" />
                        </div>
                        
                        <button
                          onClick={() => { setClaimStep('processing'); processRedemption(destinationCode); }}
                          className="w-full bg-surface-container-high text-ink py-4 rounded-full font-headline font-bold text-sm tracking-[0.2em] uppercase active:scale-[0.98] snappy flex items-center justify-center gap-3 border border-outline-variant hover:border-ink"
                        >
                          <span className="material-symbols-outlined text-lg">storefront</span>
                          Pay at Counter
                        </button>
                      </>
                    )}

                    {claimError && (
                      <div className="p-3 bg-error-container text-on-error-container rounded-sm text-sm font-body">{claimError}</div>
                    )}

                    <button
                      onClick={() => { setClaimStep('enter-amount'); setClaimError(''); stopCamera(); setScanningQR(false); setDestinationCode(''); }}
                      className="w-full py-3 font-mono text-xs text-muted uppercase tracking-widest hover:text-ink snappy"
                    >
                      ← Change Amount
                    </button>
                  </div>
                </section>
              )}

              {/* ── Processing State ── */}
              {claimStep === 'processing' && (
                <section className="mx-6 mt-8">
                  <div className="bg-surface-container-lowest p-8 editorial-shadow text-center">
                    <div className="relative h-20 w-20 mx-auto mb-6">
                      <div className="absolute inset-0 border-4 border-surface-container-high rounded-full" />
                      <div className="absolute inset-0 border-4 border-amber border-t-transparent rounded-full animate-spin" />
                    </div>
                    <h4 className="font-headline font-bold text-xl text-ink uppercase tracking-tight mb-2">
                      Processing Payment
                    </h4>
                    <p className="font-body text-sm text-on-surface-variant">
                      Please wait while we verify your transaction…
                    </p>
                  </div>
                </section>
              )}

              {/* ── Success State ── */}
              {claimStep === 'success' && redeemResult && (
                <section className="mx-6 mt-8">
                  <div className="bg-charcoal p-6 editorial-shadow text-white space-y-4">
                    {/* Success icon */}
                    <div className="flex justify-center mb-2">
                      <div className="h-16 w-16 flex items-center justify-center bg-green-600 rounded-full">
                        <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="font-mono text-xs uppercase tracking-widest text-amber mb-1">Deal Claimed Successfully!</p>
                      <p className="font-body text-sm text-white/80">{redeemResult.message}</p>
                    </div>

                    {/* Voucher code */}
                    {redeemResult.qrToken && (
                      <div className="border-t border-dashed border-white/20 pt-4">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-white/60 mb-2 text-center">Your Voucher Code</p>
                        <p className="font-mono text-xl font-bold text-amber tracking-widest text-center bg-white/10 py-3 rounded-sm">
                          {redeemResult.qrToken}
                        </p>
                      </div>
                    )}

                    {/* QR image if returned from backend */}
                    {redeemResult.qrImageBase64 && (
                      <div className="flex justify-center">
                        <img
                          src={`data:image/png;base64,${redeemResult.qrImageBase64}`}
                          alt="QR Code"
                          className="w-40 h-40 bg-white p-2 rounded-sm"
                        />
                      </div>
                    )}

                    {/* Receipt summary */}
                    <div className="border-t border-dashed border-white/20 pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="font-body text-sm text-white/60">Original Amount</span>
                        <span className="font-mono text-sm">₹{parsedAmount.toFixed(2)}</span>
                      </div>
                      {discountCalc.discount > 0 && (
                        <div className="flex justify-between">
                          <span className="font-body text-sm text-green-400">Discount</span>
                          <span className="font-mono text-sm text-green-400">- ₹{discountCalc.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-white/10 pt-2">
                        <span className="font-headline font-bold text-sm uppercase">Total Paid</span>
                        <span className="font-mono text-lg font-bold text-amber">₹{discountCalc.finalAmount.toFixed(2)}</span>
                      </div>
                      {redeemResult.cashbackAmount && redeemResult.cashbackAmount > 0 && (
                        <p className="font-mono text-xs text-green-400 uppercase tracking-wider text-center mt-2">
                          + ₹{redeemResult.cashbackAmount} cashback credited to wallet
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ── How to Claim (only show in idle state) ── */}
              {claimStep === 'idle' && (
                <>
                  {error && (
                    <div className="mx-6 mt-6 p-4 bg-error-container text-on-error-container rounded-sm text-sm font-body">{error}</div>
                  )}

                  <section className="mt-10 px-6">
                    <h3 className="font-headline font-medium text-xl uppercase tracking-tight mb-6">How to Claim</h3>
                    <div className="space-y-6">
                      {[
                        { n: '01', title: 'Tap Claim', desc: 'Hit the button below to start the claim process. We\'ll verify your student status first.', icon: 'touch_app' },
                        { n: '02', title: 'Enter Order Amount', desc: 'Tell us how much your order is worth. The discount is auto-calculated live.', icon: 'calculate' },
                        { n: '03', title: 'Scan & Pay', desc: 'Scan the shop\'s QR code or pay directly from your StudEX wallet.', icon: 'qr_code_scanner' },
                      ].map(({ n, title, desc, icon }) => (
                        <div key={n} className="flex gap-5 pl-5 border-l-4 border-amber">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-surface-container-high rounded-sm">
                            <span className="material-symbols-outlined text-ink text-[20px]">{icon}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-body font-bold text-sm mb-0.5 text-ink">{title}</p>
                            <p className="text-muted text-xs leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Location */}
                  {(deal.address || deal.vendor?.address) && (
                    <section className="mt-10 px-6">
                      <h3 className="font-headline font-medium text-xl uppercase tracking-tight mb-4">Location</h3>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant mt-0.5">place</span>
                        <div>
                          <p className="font-body text-sm font-bold text-ink">{deal.address || deal.vendor?.address}</p>
                          {deal.vendor?.address && deal.address && deal.address !== deal.vendor.address && (
                            <p className="font-body text-xs text-on-surface-variant">{deal.vendor.address}</p>
                          )}
                        </div>
                      </div>
                      {deal.googleMapsUrl && (
                        <a
                          href={deal.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 w-full py-4 border-2 border-ink font-headline font-bold text-sm uppercase tracking-widest hover:bg-ink hover:text-white snappy active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">navigation</span>
                          Get Directions
                        </a>
                      )}
                    </section>
                  )}

                  {/* Terms */}
                  {deal.termsAndConditions && (
                    <section className="mt-10 px-6">
                      <h3 className="font-headline font-medium text-xl uppercase tracking-tight mb-4">Terms</h3>
                      <div className="p-5 bg-surface-container-high rounded-sm">
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-muted text-[20px]">info</span>
                          <p className="text-xs text-muted leading-normal font-body">{deal.termsAndConditions}</p>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Tags */}
                  <section className="mt-10 px-6 pb-6">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-surface-container text-on-surface-variant font-mono text-[10px] uppercase">{deal.vendor?.category || deal.category}</span>
                      {deal.cashbackAmount > 0 && (
                        <span className="px-3 py-1 bg-surface-container text-on-surface-variant font-mono text-[10px] uppercase">Cashback</span>
                      )}
                      <span className="px-3 py-1 bg-surface-container text-on-surface-variant font-mono text-[10px] uppercase">Student Only</span>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>

        {/* ═══ Fixed Bottom CTA ═══ */}
        {deal && !fetching && (
          <div className="absolute bottom-0 left-0 w-full z-50 bg-surface-container-lowest px-6 py-5 editorial-shadow">
            {claimStep === 'idle' && (
              <button
                onClick={handleClaimClick}
                className="w-full bg-ink text-white py-5 rounded-full font-headline font-bold text-sm tracking-[0.2em] uppercase active:scale-[0.98] snappy flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined text-lg">payments</span>
                Claim This Deal
              </button>
            )}
            {claimStep === 'success' && (
              <button
                onClick={handleClose}
                className="w-full bg-surface-container-lowest border-2 border-ink text-ink py-5 rounded-full font-headline font-bold text-sm tracking-[0.2em] uppercase snappy flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Back to Deals
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
