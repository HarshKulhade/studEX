'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { opportunityApi } from '@/lib/api';
import BottomNav from '@/components/BottomNav';

interface Opportunity {
  _id: string;
  title: string;
  type: 'internship' | 'job' | 'freelance' | 'scholarship' | 'event';
  description: string;
  location?: string;
  isRemote: boolean;
  stipend?: number;
  stipendType?: string;
  applicationLink?: string;
  deadline?: unknown;
  postedBy?: string;
}

const TYPE_LABELS: Record<string, string> = {
  internship: 'Internship',
  job: 'Full-time',
  freelance: 'Freelance',
  scholarship: 'Scholarship',
  event: 'Event',
};

const TYPE_COLORS: Record<string, string> = {
  internship: 'bg-amber text-ink',
  job: 'bg-ink text-white',
  freelance: 'bg-primary text-white',
  scholarship: 'bg-green-600 text-white',
  event: 'bg-tertiary text-white',
};

const FILTERS = ['All', 'internship', 'job', 'freelance', 'scholarship', 'event'];

function formatDate(ts: unknown) {
  if (!ts) return null;
  try {
    let d: Date;
    if ((ts as any).toDate) {
      d = (ts as any).toDate();
    } else if (typeof ts === 'object' && ts !== null && '_seconds' in ts) {
      d = new Date((ts as any)._seconds * 1000);
    } else {
      d = new Date(ts as string | number);
    }
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

export default function OpportunitiesPage() {
  const { loading, firebaseUser } = useAuth();
  const router = useRouter();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [firebaseUser, loading, router]);

  const fetchOpps = useCallback(async () => {
    setFetching(true);
    try {
      const params = filter !== 'All' ? { type: filter, limit: 50 } : { limit: 50 };
      const res = await opportunityApi.getOpportunities(params) as { data: Opportunity[] };
      setOpps(res.data || []);
    } catch {
      setOpps([]);
    } finally {
      setFetching(false);
    }
  }, [filter]);

  useEffect(() => { if (!loading && firebaseUser) fetchOpps(); }, [loading, firebaseUser, fetchOpps]);

  const filtered = opps.filter((o) =>
    search ? o.title.toLowerCase().includes(search.toLowerCase()) || (o.location || '').toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="min-h-screen bg-[#F7F4EF] pb-28 overflow-x-hidden w-full">
      {/* Header */}
      <header className="bg-[#F7F4EF] sticky top-0 z-40 flex items-center justify-between px-6 py-4">
        <div>
          <span className="font-headline font-black text-2xl tracking-tighter text-ink uppercase">Careers</span>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Jobs & Opportunities</div>
        </div>
        <span className="font-headline font-bold text-sm text-muted uppercase tracking-widest">{filtered.length} posts</span>
      </header>

      <main className="px-6 space-y-6 mt-2">
        <h1 className="font-headline font-extrabold text-[28px] sm:text-4xl uppercase tracking-tighter text-ink leading-none break-words">
          Opportunities
        </h1>

        {/* Search */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-4 text-muted">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs, internships…"
            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-full py-4 pl-12 pr-6 focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber snappy font-body text-sm"
          />
        </div>

        {/* Filter strip */}
        <div className="overflow-x-auto no-scrollbar -mx-6 px-6">
          <div className="flex gap-3 min-w-max">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2.5 rounded-full font-body font-bold text-sm snappy capitalize ${
                  filter === f ? 'bg-ink text-white' : 'bg-surface-container-lowest border border-outline-variant/40 text-muted hover:text-ink'
                }`}
              >
                {f === 'All' ? 'All' : TYPE_LABELS[f] || f}
              </button>
            ))}
          </div>
        </div>

        {/* Opportunities list */}
        {fetching ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface-container-lowest editorial-shadow p-6 rounded-2xl animate-pulse space-y-3">
                <div className="h-3 bg-surface-container-high rounded w-1/4" />
                <div className="h-5 bg-surface-container-high rounded w-3/4" />
                <div className="h-3 bg-surface-container-high rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-6xl text-muted">work_off</span>
            <p className="font-headline font-bold text-2xl uppercase mt-4 text-ink">No Opportunities Found</p>
            <p className="font-body text-on-surface-variant mt-2">Check back soon for new postings.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((opp) => {
              const deadline = formatDate(opp.deadline);
              return (
                <div key={opp._id} className="bg-surface-container-lowest editorial-shadow p-6 rounded-2xl space-y-4">
                  {/* Type + Remote */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-mono text-[10px] px-3 py-1 uppercase tracking-widest font-bold rounded ${TYPE_COLORS[opp.type] || 'bg-surface-container-high text-ink'}`}>
                      {TYPE_LABELS[opp.type] || opp.type}
                    </span>
                    {opp.isRemote && (
                      <span className="font-mono text-[10px] px-3 py-1 uppercase tracking-widest font-bold rounded bg-surface-container-high text-on-surface-variant">
                        Remote
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-headline font-bold text-2xl uppercase tracking-tight text-ink leading-tight">
                      {opp.title}
                    </h3>
                    {opp.postedBy && (
                      <p className="font-body text-sm text-on-surface-variant mt-1">{opp.postedBy}</p>
                    )}
                  </div>

                  {opp.description && (
                    <p className="font-body text-sm text-muted leading-relaxed line-clamp-3">{opp.description}</p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {opp.location && (
                      <span className="flex items-center gap-1 font-mono text-xs text-muted">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        {opp.location}
                      </span>
                    )}
                    {opp.stipend != null && (
                      <span className="font-mono text-xs font-bold text-amber">
                        ₹{opp.stipend.toLocaleString('en-IN')}/{opp.stipendType || 'month'}
                      </span>
                    )}
                    {deadline && (
                      <span className="font-mono text-xs text-tertiary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">event</span>
                        Deadline: {deadline}
                      </span>
                    )}
                  </div>

                  {/* Apply */}
                  {opp.applicationLink && (
                    <a
                      href={opp.applicationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-ink text-white px-6 py-3 rounded-full font-headline font-bold text-sm uppercase tracking-widest hover:bg-charcoal snappy"
                    >
                      Apply Now <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
