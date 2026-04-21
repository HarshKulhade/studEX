'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/+$/, '') + '/api/admin';
const ADMIN_EMAIL = 'harshkulhade95@gmail.com';

interface Deal {
  _id: string;
  shopName?: string;
  title: string;
  offer?: string;
  rating?: number;
  category?: string;
  address?: string;
  googleMapsUrl?: string;
  isActive: boolean;
  validUntil?: any;
  description?: string;
  coverImageUrl?: string;
}

interface Opportunity {
  _id: string;
  title: string;
  company: string;
  type: string;
  location: string;
  stipend?: string;
  applyUrl?: string;
  deadline?: any;
}

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  college?: string;
  avatarUrl?: string;
  collegeIdImageUrl?: string;
  isVerified: boolean;
  verificationStatus: string;
}

interface Stats { totalUsers: number; totalDeals: number; totalVendors: number; }

const EMPTY_DEAL = {
  shopName: '', title: '', offer: '', rating: '4.0', category: 'food',
  address: '', lat: '', lng: '', googleMapsUrl: '', description: '',
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  isActive: true,
  coverImage: null as File | null,
};
const EMPTY_OPP = {
  title: '', company: '', type: 'internship', location: '', stipend: '', applyUrl: '',
  deadline: '', description: '',
};

// ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [admin, setAdmin] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('harshkulhade95@gmail.com');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<'deals' | 'opportunities' | 'users'>('deals');

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Forms
  const [dealForm, setDealForm] = useState({ ...EMPTY_DEAL });
  const [oppForm, setOppForm] = useState({ ...EMPTY_OPP });
  const [editingDeal, setEditingDeal] = useState<string | null>(null);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showOppForm, setShowOppForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [verifyingUser, setVerifyingUser] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email === ADMIN_EMAIL) setAdmin(user);
      else setAdmin(null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const getToken = async () => {
    if (!admin) return '';
    return admin.getIdToken();
  };

  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const token = await getToken();
    const isFormData = options?.body instanceof FormData;
    
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const res = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'API error');
    return data;
  }, [admin]);

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const [s, d, o, u] = await Promise.all([
        apiFetch('/stats'),
        apiFetch('/deals'),
        apiFetch('/opportunities'),
        apiFetch('/users'),
      ]);
      setStats(s.data);
      setDeals(d.data || []);
      setOpps(o.data || []);
      setUsers(u.data || []);
    } catch (e: any) {
      setMsg(`Load error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [admin, apiFetch]);

  useEffect(() => { load(); }, [load]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setLoginError('Not an admin account.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const fd = new FormData();
      Object.entries(dealForm).forEach(([k, v]) => {
        if (k === 'coverImage') {
          if (v) fd.append('coverImage', v as File);
        } else {
          fd.append(k, String(v));
        }
      });

      if (editingDeal) {
        await apiFetch(`/deals/${editingDeal}`, { method: 'PUT', body: fd });
        setMsg('✅ Deal updated!');
      } else {
        await apiFetch('/deals', { method: 'POST', body: fd });
        setMsg('✅ Deal created!');
      }
      setDealForm({ ...EMPTY_DEAL });
      setEditingDeal(null);
      setShowDealForm(false);
      await load();
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeal = async (id: string) => {
    if (!confirm('Delete this deal permanently?')) return;
    try {
      await apiFetch(`/deals/${id}`, { method: 'DELETE' });
      setMsg('🗑️ Deal deleted');
      await load();
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
  };

  const handleEditDeal = (deal: Deal) => {
    const coords = (deal as any).vendorLocation?.coordinates || [0, 0];
    setDealForm({
      shopName: deal.shopName || '',
      title: deal.title || '',
      offer: deal.offer || '',
      rating: String(deal.rating || '4.0'),
      category: deal.category || 'food',
      address: deal.address || '',
      lat: String(coords[1] || ''),
      lng: String(coords[0] || ''),
      googleMapsUrl: deal.googleMapsUrl || '',
      description: deal.description || '',
      validFrom: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      isActive: deal.isActive,
      coverImage: null,
    });
    setEditingDeal(deal._id);
    setShowDealForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/opportunities', { method: 'POST', body: JSON.stringify(oppForm) });
      setMsg('✅ Opportunity created!');
      setOppForm({ ...EMPTY_OPP });
      setShowOppForm(false);
      await load();
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
    finally { setSaving(false); }
  };

  const handleDeleteOpp = async (id: string) => {
    if (!confirm('Delete this opportunity?')) return;
    try {
      await apiFetch(`/opportunities/${id}`, { method: 'DELETE' });
      setMsg('🗑️ Opportunity deleted');
      await load();
    } catch (err: any) { setMsg(`❌ ${err.message}`); }
  };

  // ── Auth loading ─────────────────────────────────
  if (authLoading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="text-white font-mono text-sm animate-pulse">Loading…</div>
    </div>
  );

  // ── Login screen ─────────────────────────────────
  if (!admin) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-8 border border-white/10">
        <div className="mb-8">
          <p className="font-mono text-[10px] text-amber uppercase tracking-widest mb-1">StudEX</p>
          <h1 className="text-white font-bold text-3xl">Admin Panel</h1>
          <p className="text-white/40 text-sm mt-1">Restricted access only</p>
        </div>
        {loginError && <div className="mb-4 p-3 bg-red-900/40 text-red-300 rounded-lg text-sm">{loginError}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-amber"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-amber"
            />
          </div>
          <button type="submit" className="w-full bg-amber text-black py-3 rounded-lg font-bold text-sm uppercase tracking-widest hover:opacity-90">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );

  // ── Admin panel ──────────────────────────────────
  const CATEGORIES = ['food', 'fashion', 'electronics', 'fitness', 'entertainment', 'education', 'beauty', 'travel', 'other'];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="bg-[#1a1a1a] border-b border-white/10 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div>
          <p className="font-mono text-[10px] text-amber uppercase tracking-widest">StudEX</p>
          <h1 className="font-bold text-xl tracking-tight">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs">{admin.email}</span>
          <button
            onClick={() => signOut(auth)}
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg font-mono uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: 'group' },
              { label: 'Total Deals', value: stats.totalDeals, icon: 'local_offer' },
              { label: 'Vendors', value: stats.totalVendors, icon: 'store' },
            ].map(s => (
              <div key={s.label} className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 text-center">
                <span className="material-symbols-outlined text-amber text-2xl">{s.icon}</span>
                <p className="text-3xl font-bold mt-2">{s.value}</p>
                <p className="text-white/40 text-xs uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Message */}
        {msg && (
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm flex justify-between items-center">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-white/40 hover:text-white ml-4">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-0">
          {(['deals', 'opportunities', 'users'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-mono uppercase tracking-wider border-b-2 transition-all ${
                tab === t ? 'border-amber text-amber' : 'border-transparent text-white/40 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── DEALS TAB ── */}
        {tab === 'deals' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Deals / Shops ({deals.length})</h2>
              <button
                onClick={() => { setShowDealForm(v => !v); setEditingDeal(null); setDealForm({ ...EMPTY_DEAL }); }}
                className="bg-amber text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add Deal
              </button>
            </div>

            {/* Deal Form */}
            {showDealForm && (
              <form onSubmit={handleSaveDeal} className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-amber uppercase tracking-wide text-sm">{editingDeal ? 'Edit Deal' : 'New Deal'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Shop Name *" required>
                    <input className={inp} value={dealForm.shopName} onChange={e => setDealForm(f => ({ ...f, shopName: e.target.value }))} required />
                  </Field>
                  <Field label="Deal Title">
                    <input className={inp} value={dealForm.title} onChange={e => setDealForm(f => ({ ...f, title: e.target.value }))} placeholder="Same as shop name if blank" />
                  </Field>
                  <Field label="Offer (e.g. 15% off on all items) *">
                    <input className={inp} value={dealForm.offer} onChange={e => setDealForm(f => ({ ...f, offer: e.target.value }))} required placeholder="15% off on all items" />
                  </Field>
                  <Field label="Rating (out of 5)">
                    <input type="number" step="0.1" min="0" max="5" className={inp} value={dealForm.rating} onChange={e => setDealForm(f => ({ ...f, rating: e.target.value }))} />
                  </Field>
                  <Field label="Category">
                    <select className={inp} value={dealForm.category} onChange={e => setDealForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Address">
                    <input className={inp} value={dealForm.address} onChange={e => setDealForm(f => ({ ...f, address: e.target.value }))} placeholder="Shop address" />
                  </Field>
                  <Field label="Latitude (for Maps)">
                    <input className={inp} value={dealForm.lat} onChange={e => setDealForm(f => ({ ...f, lat: e.target.value }))} placeholder="e.g. 22.7196" />
                  </Field>
                  <Field label="Longitude (default/fallback)">
                    <input className={inp} value={dealForm.lng} onChange={e => setDealForm(f => ({ ...f, lng: e.target.value }))} placeholder="e.g. 75.8577" />
                  </Field>
                  <Field label="Google Maps URL">
                    <input className={inp} value={dealForm.googleMapsUrl} onChange={e => setDealForm(f => ({ ...f, googleMapsUrl: e.target.value }))} placeholder="e.g. https://maps.app.goo.gl/..." />
                  </Field>
                  <Field label="Valid From">
                    <input type="date" className={inp} value={dealForm.validFrom} onChange={e => setDealForm(f => ({ ...f, validFrom: e.target.value }))} />
                  </Field>
                  <Field label="Valid Until">
                    <input type="date" className={inp} value={dealForm.validUntil} onChange={e => setDealForm(f => ({ ...f, validUntil: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea className={`${inp} h-20 resize-none`} value={dealForm.description} onChange={e => setDealForm(f => ({ ...f, description: e.target.value }))} />
                </Field>
                <Field label="Cover Image">
                  <input type="file" accept="image/*" onChange={e => setDealForm(f => ({ ...f, coverImage: e.target.files?.[0] || null }))} className="text-sm text-white/70" />
                </Field>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={dealForm.isActive} onChange={e => setDealForm(f => ({ ...f, isActive: e.target.checked }))} className="accent-amber w-4 h-4" />
                  <span className="text-sm text-white/70">Active (visible to students)</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="bg-amber text-black px-6 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50">
                    {saving ? 'Saving…' : editingDeal ? 'Update Deal' : 'Create Deal'}
                  </button>
                  <button type="button" onClick={() => { setShowDealForm(false); setEditingDeal(null); }} className="bg-white/10 px-6 py-2.5 rounded-lg text-sm hover:bg-white/20">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Deal List */}
            {loading ? <p className="text-white/40 text-sm">Loading…</p> : (
              <div className="space-y-3">
                {deals.length === 0 && <p className="text-white/40 text-sm">No deals yet. Click "Add Deal" to get started.</p>}
                {deals.map(deal => (
                  <div key={deal._id} className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {deal.coverImageUrl && (
                        <div className="mb-3 w-16 h-16 rounded overflow-hidden">
                          <img src={deal.coverImageUrl} alt="Deal cover" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${deal.isActive ? 'bg-green-400' : 'bg-white/20'}`} />
                        <h3 className="font-bold text-base truncate">{deal.shopName || deal.title}</h3>
                        <span className="font-mono text-[10px] text-amber bg-amber/10 px-2 py-0.5 rounded-full uppercase">{deal.category}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {deal.offer && (
                          <span className="text-green-400 font-bold text-sm">{deal.offer}</span>
                        )}
                        {deal.rating !== undefined && deal.rating > 0 && (
                          <span className="flex items-center gap-1 text-amber text-sm font-bold">
                            ★ {Number(deal.rating).toFixed(1)}
                          </span>
                        )}
                        {deal.address && (
                          <span className="text-white/40 text-xs truncate max-w-[200px]">{deal.address}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {deal.googleMapsUrl && (
                        <a
                          href={deal.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider"
                        >
                          <span className="material-symbols-outlined text-sm">map</span>
                          Maps
                        </a>
                      )}
                      <button onClick={() => handleEditDeal(deal)} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-xs">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => handleDeleteDeal(deal._id)} className="bg-red-900/30 hover:bg-red-900/60 text-red-400 px-3 py-2 rounded-lg text-xs">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── OPPORTUNITIES TAB ── */}
        {tab === 'opportunities' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Opportunities ({opps.length})</h2>
              <button
                onClick={() => setShowOppForm(v => !v)}
                className="bg-amber text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add Opportunity
              </button>
            </div>

            {showOppForm && (
              <form onSubmit={handleSaveOpp} className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-amber uppercase tracking-wide text-sm">New Opportunity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Title *"><input className={inp} required value={oppForm.title} onChange={e => setOppForm(f => ({ ...f, title: e.target.value }))} /></Field>
                  <Field label="Company *"><input className={inp} required value={oppForm.company} onChange={e => setOppForm(f => ({ ...f, company: e.target.value }))} /></Field>
                  <Field label="Type">
                    <select className={inp} value={oppForm.type} onChange={e => setOppForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="internship">Internship</option>
                      <option value="job">Full-time Job</option>
                      <option value="freelance">Freelance</option>
                      <option value="scholarship">Scholarship</option>
                    </select>
                  </Field>
                  <Field label="Location"><input className={inp} value={oppForm.location} onChange={e => setOppForm(f => ({ ...f, location: e.target.value }))} placeholder="Remote / City" /></Field>
                  <Field label="Stipend / Package"><input className={inp} value={oppForm.stipend} onChange={e => setOppForm(f => ({ ...f, stipend: e.target.value }))} placeholder="₹10,000/month" /></Field>
                  <Field label="Apply URL"><input className={inp} type="url" value={oppForm.applyUrl} onChange={e => setOppForm(f => ({ ...f, applyUrl: e.target.value }))} placeholder="https://..." /></Field>
                  <Field label="Deadline"><input type="date" className={inp} value={oppForm.deadline} onChange={e => setOppForm(f => ({ ...f, deadline: e.target.value }))} /></Field>
                </div>
                <Field label="Description"><textarea className={`${inp} h-20 resize-none`} value={oppForm.description} onChange={e => setOppForm(f => ({ ...f, description: e.target.value }))} /></Field>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="bg-amber text-black px-6 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Create Opportunity'}
                  </button>
                  <button type="button" onClick={() => setShowOppForm(false)} className="bg-white/10 px-6 py-2.5 rounded-lg text-sm hover:bg-white/20">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {opps.length === 0 && <p className="text-white/40 text-sm">No opportunities yet.</p>}
              {opps.map(o => (
                <div key={o._id} className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 flex justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{o.title}</h3>
                      <span className="font-mono text-[10px] text-amber bg-amber/10 px-2 py-0.5 rounded-full uppercase">{o.type}</span>
                    </div>
                    <p className="text-white/50 text-sm mt-1">{o.company} · {o.location}</p>
                    {o.stipend && <p className="text-green-400 text-sm font-bold mt-1">{o.stipend}</p>}
                    {o.applyUrl && <a href={o.applyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs mt-1 block hover:underline truncate max-w-sm">{o.applyUrl}</a>}
                  </div>
                  <button onClick={() => handleDeleteOpp(o._id)} className="bg-red-900/30 hover:bg-red-900/60 text-red-400 px-3 py-2 rounded-lg text-xs flex-shrink-0">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Registered Users ({users.length})</h2>
              <div className="flex gap-2 text-xs font-mono">
                <span className="text-amber">{users.filter(u => u.verificationStatus === 'pending').length} pending</span>
                <span className="text-white/20">·</span>
                <span className="text-green-400">{users.filter(u => u.verificationStatus === 'verified').length} verified</span>
              </div>
            </div>
            <div className="space-y-3">
              {users.length === 0 && <p className="text-white/40 text-sm">No users found.</p>}
              {/* Show pending users first */}
              {[...users].sort((a, b) => {
                const order: Record<string, number> = { pending: 0, unverified: 1, rejected: 2, verified: 3 };
                return (order[a.verificationStatus] ?? 4) - (order[b.verificationStatus] ?? 4);
              }).map(u => (
                <div key={u._id} className={`bg-[#1a1a1a] border rounded-2xl overflow-hidden transition-all ${
                  u.verificationStatus === 'pending' ? 'border-amber/40' :
                  u.verificationStatus === 'rejected' ? 'border-red-500/30' :
                  u.verificationStatus === 'verified' ? 'border-green-500/20' :
                  'border-white/10'
                }`}>
                  {/* User header row */}
                  <div className="px-5 py-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden border border-white/10">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{u.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{u.name}</p>
                        <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-full ${
                          u.verificationStatus === 'verified' ? 'bg-green-900/50 text-green-400' :
                          u.verificationStatus === 'pending' ? 'bg-amber/20 text-amber' :
                          u.verificationStatus === 'rejected' ? 'bg-red-900/40 text-red-400' :
                          'bg-white/10 text-white/40'
                        }`}>{u.verificationStatus}</span>
                      </div>
                      <p className="text-white/40 text-xs mt-0.5 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}{u.college ? ` · ${u.college}` : ''}</p>
                    </div>
                    {/* Quick verify/reject for pending */}
                    {u.verificationStatus === 'pending' && !u.collegeIdImageUrl && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          disabled={verifyingUser === u._id}
                          onClick={async () => {
                            setVerifyingUser(u._id);
                            try {
                              await apiFetch(`/users/${u._id}/verify`, { method: 'PUT', body: JSON.stringify({ action: 'verify' }) });
                              setMsg('✅ User verified!');
                              await load();
                            } catch (err: any) { setMsg(`❌ ${err.message}`); }
                            finally { setVerifyingUser(null); }
                          }}
                          className="bg-green-900/40 hover:bg-green-900/60 text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Verify
                        </button>
                        <button
                          disabled={verifyingUser === u._id}
                          onClick={async () => {
                            setVerifyingUser(u._id);
                            try {
                              await apiFetch(`/users/${u._id}/verify`, { method: 'PUT', body: JSON.stringify({ action: 'reject' }) });
                              setMsg('❌ User rejected');
                              await load();
                            } catch (err: any) { setMsg(`❌ ${err.message}`); }
                            finally { setVerifyingUser(null); }
                          }}
                          className="bg-red-900/30 hover:bg-red-900/60 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {u.verificationStatus === 'verified' && (
                      <span className="material-symbols-outlined text-green-400 text-xl flex-shrink-0">verified</span>
                    )}
                    {u.verificationStatus === 'rejected' && (
                      <button
                        disabled={verifyingUser === u._id}
                        onClick={async () => {
                          setVerifyingUser(u._id);
                          try {
                            await apiFetch(`/users/${u._id}/verify`, { method: 'PUT', body: JSON.stringify({ action: 'verify' }) });
                            setMsg('✅ User verified!');
                            await load();
                          } catch (err: any) { setMsg(`❌ ${err.message}`); }
                          finally { setVerifyingUser(null); }
                        }}
                        className="bg-green-900/40 hover:bg-green-900/60 text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                      >
                        Re-verify
                      </button>
                    )}
                  </div>

                  {/* Document preview section — shown if user uploaded a college ID */}
                  {u.collegeIdImageUrl && (
                    <div className={`border-t px-5 py-4 ${
                      u.verificationStatus === 'pending' ? 'border-amber/20 bg-amber/5' :
                      'border-white/5 bg-white/[0.02]'
                    }`}>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
                        <span className="material-symbols-outlined text-amber text-sm align-middle mr-1">badge</span>
                        Uploaded College ID / Enrollment Letter
                      </p>
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        <button
                          onClick={() => setPreviewImg(u.collegeIdImageUrl!)}
                          className="group relative w-32 h-24 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 hover:border-amber/50 transition-colors"
                        >
                          <img
                            src={u.collegeIdImageUrl}
                            alt="College ID"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-2xl">zoom_in</span>
                          </div>
                        </button>
                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <a
                            href={u.collegeIdImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                            Open Full Size
                          </a>
                          {u.verificationStatus === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                disabled={verifyingUser === u._id}
                                onClick={async () => {
                                  setVerifyingUser(u._id);
                                  try {
                                    await apiFetch(`/users/${u._id}/verify`, { method: 'PUT', body: JSON.stringify({ action: 'verify' }) });
                                    setMsg('✅ User verified!');
                                    await load();
                                  } catch (err: any) { setMsg(`❌ ${err.message}`); }
                                  finally { setVerifyingUser(null); }
                                }}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                {verifyingUser === u._id ? 'Processing…' : 'Verify Student'}
                              </button>
                              <button
                                disabled={verifyingUser === u._id}
                                onClick={async () => {
                                  setVerifyingUser(u._id);
                                  try {
                                    await apiFetch(`/users/${u._id}/verify`, { method: 'PUT', body: JSON.stringify({ action: 'reject' }) });
                                    setMsg('❌ User rejected');
                                    await load();
                                  } catch (err: any) { setMsg(`❌ ${err.message}`); }
                                  finally { setVerifyingUser(null); }
                                }}
                                className="bg-red-900/60 hover:bg-red-900/80 text-red-300 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Image Preview Modal */}
      {previewImg && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute -top-3 -right-3 bg-white/10 hover:bg-white/20 text-white w-8 h-8 rounded-full flex items-center justify-center z-10"
            >
              ✕
            </button>
            <img
              src={previewImg}
              alt="Document Preview"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl border border-white/10"
            />
            <div className="mt-3 text-center">
              <a
                href={previewImg}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber text-sm hover:underline"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────
const inp = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-amber';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">{label}{required && ' *'}</label>
      {children}
    </div>
  );
}
