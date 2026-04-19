'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { dealApi } from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import DealPopup from '@/components/DealPopup';

interface Deal {
  _id: string;
  title: string;
  shopName?: string;
  description?: string;
  offer?: string;
  rating?: number;
  discountType?: string;
  discountValue?: number;
  cashbackAmount?: number;
  category: string;
  address?: string;
  googleMapsUrl?: string;
  validUntil?: unknown;
  distanceMetres?: number;
  vendor?: {
    _id: string;
    businessName: string;
    address: string;
    category: string;
    rating: number;
    logoUrl?: string;
  } | null;
}

const CATEGORIES = ['All', 'food', 'fashion', 'electronics', 'fitness', 'entertainment', 'education', 'beauty', 'travel', 'other'];

const BADGE_COLORS: Record<string, string> = {
  food:          'bg-orange-500 text-white',
  fashion:       'bg-pink-500 text-white',
  electronics:   'bg-blue-600 text-white',
  fitness:       'bg-green-600 text-white',
  entertainment: 'bg-purple-600 text-white',
  education:     'bg-sky-600 text-white',
  beauty:        'bg-rose-500 text-white',
  travel:        'bg-teal-600 text-white',
  other:         'bg-amber text-ink',
};

function offerLabel(deal: Deal): string {
  if (deal.offer) return deal.offer;
  if (deal.discountType === 'percentage' && deal.discountValue) return `${deal.discountValue}% OFF`;
  if (deal.discountType === 'flat' && deal.discountValue) return `₹${deal.discountValue} OFF`;
  return '';
}

function shopName(deal: Deal): string {
  return deal.shopName || deal.vendor?.businessName || deal.title;
}

function distanceLabel(m?: number): string {
  if (!m && m !== 0) return '';
  if (m < 1000) return `${m}m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

function StarRating({ rating }: { rating: number }) {
  const stars = Math.round(rating * 2) / 2; // half-star precision
  return (
    <span className="flex items-center gap-0.5 text-amber text-xs font-bold">
      {'★'.repeat(Math.floor(stars))}{'☆'.repeat(5 - Math.floor(stars))}
      <span className="ml-1 text-muted font-normal">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function DealsPage() {
  const { token, loading, firebaseUser } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Location state
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [areaName, setAreaName] = useState<string>('');

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [firebaseUser, loading, router]);

  // Ask for location on mount
  useEffect(() => {
    requestLocation();
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const addr = data.address || {};
      // Pick the most granular available field
      const name =
        addr.suburb ||
        addr.neighbourhood ||
        addr.village ||
        addr.city_district ||
        addr.town ||
        addr.city ||
        addr.county ||
        '';
      setAreaName(name);
    } catch {
      setAreaName('');
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      // Fallback for browsers without geolocation
      const lat = 22.7196, lng = 75.8577;
      setUserLoc({ lat, lng });
      setLocState('granted');
      reverseGeocode(lat, lng);
      return;
    }
    setLocState('requesting');
    setAreaName('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLoc({ lat, lng });
        setLocState('granted');
        reverseGeocode(lat, lng);
      },
      () => {
        // Denied — use Indore fallback
        const lat = 22.7196, lng = 75.8577;
        setUserLoc({ lat, lng });
        setLocState('denied');
        reverseGeocode(lat, lng);
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const fetchDeals = useCallback(async () => {
    if (!token || !userLoc) return;
    setFetching(true);
    try {
      const params: { lat: number; lng: number; radius?: number; category?: string; page?: number; limit?: number } = {
        lat: userLoc.lat,
        lng: userLoc.lng,
        radius: 2000, // strict 2km
        limit: 50,
        ...(category !== 'All' ? { category: category.toLowerCase() } : {}),
      };
      const res = await dealApi.getNearbyDeals(token, params) as { data: Deal[] };
      setDeals(res.data || []);
    } catch {
      setDeals([]);
    } finally {
      setFetching(false);
    }
  }, [token, userLoc, category]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const filtered = deals.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      shopName(d).toLowerCase().includes(q) ||
      (d.offer || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#F7F4EF] pb-28 overflow-x-hidden">
      {/* Header */}
      <header className="bg-[#F7F4EF] sticky top-0 z-40 px-6 py-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-headline font-black text-2xl tracking-tighter text-ink uppercase">Deals</span>
          <button
            onClick={requestLocation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold snappy ${
              locState === 'granted'
                ? 'bg-green-100 text-green-700'
                : locState === 'denied'
                ? 'bg-red-100 text-red-600'
                : 'bg-surface-container-high text-muted'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {locState === 'granted' ? 'location_on' : locState === 'denied' ? 'location_off' : 'my_location'}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wide max-w-[120px] truncate">
              {locState === 'requesting'
                ? 'Getting location…'
                : locState === 'denied'
                ? (areaName || 'Location denied')
                : (areaName || '2km radius')}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-4 text-muted">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shops and deals…"
            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-full py-3 pl-12 pr-6 focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber snappy font-body text-sm"
          />
        </div>
      </header>

      {/* Location permission banner */}
      {locState === 'idle' || locState === 'requesting' ? (
        <div className="mx-6 mb-4 bg-amber/10 border border-amber/30 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber text-2xl flex-shrink-0">location_searching</span>
          <div>
            <p className="font-headline font-bold text-sm text-ink">Requesting your location…</p>
            <p className="font-body text-xs text-muted mt-0.5">We need your location to show deals within 2km of you.</p>
          </div>
        </div>
      ) : locState === 'denied' ? (
        <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-2xl flex-shrink-0">location_off</span>
          <div>
            <p className="font-headline font-bold text-sm text-ink">Location access denied</p>
            <p className="font-body text-xs text-muted mt-0.5">Showing deals near Indore campus as default. Enable location for accurate results.</p>
          </div>
        </div>
      ) : null}

      <main className="px-6 space-y-5 mt-1">
        {/* Title row */}
        <div className="flex items-end justify-between">
          <h1 className="font-headline font-extrabold text-4xl uppercase tracking-tighter text-ink leading-tight">
            Nearby<br />Deals
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-1">
            {fetching ? 'Loading…' : `${filtered.length} found`}
          </p>
        </div>

        {/* Category Strip */}
        <div className="overflow-x-auto no-scrollbar -mx-6 px-6">
          <div className="flex gap-2 min-w-max pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full font-body font-bold text-xs snappy capitalize whitespace-nowrap ${
                  category === cat
                    ? 'bg-ink text-white'
                    : 'bg-surface-container-lowest border border-outline-variant/40 text-muted hover:text-ink'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Deals Grid */}
        {fetching ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow animate-pulse">
                <div className="h-36 bg-surface-container-high" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-surface-container-high rounded w-3/4" />
                  <div className="h-3 bg-surface-container-high rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-6xl text-muted">storefront</span>
            <p className="font-headline font-bold text-2xl uppercase tracking-tight text-ink mt-4">No Deals Nearby</p>
            <p className="font-body text-on-surface-variant mt-2 text-sm">
              {locState === 'denied' ? 'Enable location for accurate results.' : 'No deals found within 2km of your location.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((deal) => {
              const name = shopName(deal);
              const offer = offerLabel(deal);
              const rating = deal.rating ?? deal.vendor?.rating ?? 0;
              const badgeColor = BADGE_COLORS[deal.category] || 'bg-amber text-ink';

              return (
                <div
                  key={deal._id}
                  onClick={() => setSelectedDealId(deal._id)}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow flex flex-col cursor-pointer active:scale-[0.97] snappy"
                >
                  {/* Banner */}
                  <div className={`relative h-28 flex items-center justify-center ${badgeColor.split(' ')[0]} bg-opacity-15`}
                    style={{ background: `linear-gradient(135deg, var(--color-surface-container-high) 0%, var(--color-surface-container-highest, #E8E4DD) 100%)` }}
                  >
                    {/* Shop initial */}
                    <span className="font-headline font-black text-5xl text-ink/10 select-none uppercase">
                      {name.charAt(0)}
                    </span>
                    {/* Offer badge */}
                    {offer && (
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${badgeColor}`}>
                        {offer}
                      </div>
                    )}
                    {/* Distance */}
                    {deal.distanceMetres != null && (
                      <div className="absolute bottom-2 right-2 bg-black/30 text-white px-2 py-0.5 rounded-full text-[10px] font-mono">
                        {distanceLabel(deal.distanceMetres)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col gap-1.5">
                    <h3 className="font-headline font-bold text-sm leading-tight text-ink line-clamp-1">{name}</h3>

                    {/* Rating */}
                    {rating > 0 && <StarRating rating={rating} />}

                    {/* Category */}
                    <span className={`self-start px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide ${badgeColor}`}>
                      {deal.category}
                    </span>

                    {/* Address */}
                    {(deal.address || deal.vendor?.address) && (
                      <p className="font-body text-[11px] text-muted line-clamp-1">
                        {deal.address || deal.vendor?.address}
                      </p>
                    )}

                    {/* Google Maps button */}
                    {deal.googleMapsUrl && (
                      <a
                        href={deal.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-auto flex items-center justify-center gap-1 bg-ink text-white rounded-lg py-2 text-[11px] font-bold uppercase tracking-wide snappy hover:bg-charcoal"
                      >
                        <span className="material-symbols-outlined text-sm">navigation</span>
                        Navigate
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Deal Popup — Stitch Design System */}
      {selectedDealId && (
        <DealPopup
          dealId={selectedDealId}
          onClose={() => setSelectedDealId(null)}
        />
      )}
    </div>
  );
}
