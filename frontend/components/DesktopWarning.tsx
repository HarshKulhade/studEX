'use client';

import { useState, useEffect } from 'react';

export default function DesktopWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on screens wider than 1024px (desktop)
    const isDesktop = window.innerWidth > 1024;
    const dismissed = sessionStorage.getItem('desktop-warning-dismissed');
    if (isDesktop && !dismissed) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('desktop-warning-dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/60 backdrop-blur-sm">
      <div
        className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-surface border-2 border-outline-variant editorial-shadow"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="desktop-warning-title"
        aria-describedby="desktop-warning-desc"
      >
        {/* Amber accent bar */}
        <div className="h-1.5 w-full bg-primary-container" />

        <div className="px-6 pt-6 pb-8 text-center">
          {/* Caution icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed">
            <span className="material-symbols-outlined text-on-primary-container" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}>
              phone_iphone
            </span>
          </div>

          <h2
            id="desktop-warning-title"
            className="font-headline text-xl font-bold text-ink mb-2"
          >
            Best on Mobile
          </h2>

          <p
            id="desktop-warning-desc"
            className="font-body text-sm text-on-surface-variant leading-relaxed mb-6"
          >
            StudEX is designed for <strong className="text-ink">mobile</strong> and{' '}
            <strong className="text-ink">tablet</strong> screens. For the best experience,
            open this on your phone or resize your browser.
          </p>

          {/* QR hint */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-xs font-mono text-on-surface-variant">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              qr_code_2
            </span>
            Scan or visit <span className="font-bold text-primary">studexedu.vercel.app</span>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              id="desktop-warning-continue"
              onClick={handleDismiss}
              className="w-full rounded-full bg-primary-container py-3 px-6 font-headline text-sm font-bold text-on-primary-container 
                         transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            >
              Continue Anyway
            </button>
            <button
              id="desktop-warning-dismiss"
              onClick={handleDismiss}
              className="w-full rounded-full border border-outline-variant py-3 px-6 font-body text-sm text-on-surface-variant
                         transition-all duration-150 hover:bg-surface-container-high active:scale-[0.98]"
            >
              Don&apos;t show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
