'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { studentApi } from '@/lib/api';
import BottomNav from '@/components/BottomNav';

interface ProfileData {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  college?: string;
  isVerified: boolean;
  verificationStatus: string;
  avatarUrl?: string;
  collegeIdImageUrl?: string;
}

const VERIFICATION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  verified:   { label: '✅ Verified',       color: 'text-green-700', bg: 'bg-green-50' },
  pending:    { label: '⏳ Pending Review',  color: 'text-amber',     bg: 'bg-surface-container-high' },
  unverified: { label: '⚠️ Unverified',     color: 'text-tertiary',   bg: 'bg-error-container/30' },
};

export default function ProfilePage() {
  const { token, loading, firebaseUser, logout, refreshStudent } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', college: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [firebaseUser, loading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const pRes = await studentApi.getProfile(token) as { data: ProfileData };
      setProfile(pRes.data);
      setForm({
        name: pRes.data.name || '',
        phone: pRes.data.phone || '',
        college: pRes.data.college || '',
      });
    } catch { /* silently fail */ }
    finally { setFetching(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await studentApi.updateProfile(token, form);
      await refreshStudent();
      await load();
      setSaveMsg('Profile updated!');
      setEditing(false);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await studentApi.uploadAvatar(token, fd);
      await load();
    } catch { /* silently fail */ }
    finally { setUploadingAvatar(false); }
  };

  const handleCollegeIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploadingId(true);
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('collegeId', file);
      const res = await studentApi.uploadCollegeId(token, fd) as { message: string };
      setUploadMsg(res.message || 'Uploaded!');
      await load();
    } catch (err: unknown) {
      setUploadMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingId(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center">
        <div className="font-headline font-black text-4xl tracking-tighter text-ink animate-pulse">STUDEX</div>
      </div>
    );
  }

  const vs = profile?.verificationStatus || 'unverified';
  const initials = (profile?.name || 'S').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const vsStyle = VERIFICATION_LABELS[vs] || VERIFICATION_LABELS.unverified;

  return (
    <div className="min-h-screen bg-[#F7F4EF] pb-28 overflow-x-hidden">
      {/* Header */}
      <header className="bg-[#F7F4EF] sticky top-0 z-40 flex justify-between items-center px-6 py-4">
        <button onClick={() => router.back()} className="text-ink">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="font-headline font-black text-2xl tracking-tighter text-ink uppercase">Profile</span>
        <button
          onClick={() => { setEditing((e) => !e); setSaveMsg(''); }}
          className="text-muted hover:text-ink snappy"
        >
          <span className="material-symbols-outlined">{editing ? 'close' : 'edit'}</span>
        </button>
      </header>

      <main className="px-6 space-y-6 mt-2">

        {/* Avatar */}
        <section className="flex flex-col items-center gap-4 pt-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-amber flex items-center justify-center text-white font-headline font-black text-3xl editorial-shadow overflow-hidden border-4 border-white">
              {uploadingAvatar ? (
                <span className="material-symbols-outlined text-white text-3xl animate-spin">refresh</span>
              ) : profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            {/* Camera button */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-ink text-white rounded-full flex items-center justify-center border-2 border-white snappy hover:bg-charcoal"
              aria-label="Upload profile picture"
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="text-center">
            <h1 className="font-headline font-extrabold text-3xl uppercase tracking-tighter text-ink leading-tight">
              {profile?.name}
            </h1>
            <p className="font-mono text-xs uppercase tracking-widest text-muted mt-1">{profile?.email}</p>
            <span className={`font-mono text-xs font-bold mt-1 inline-block ${vsStyle.color}`}>
              {vsStyle.label}
            </span>
          </div>
        </section>

        {/* Save Message */}
        {saveMsg && (
          <div className="p-4 bg-surface-container-high text-ink rounded-xl font-body text-sm">{saveMsg}</div>
        )}

        {/* Personal Info */}
        <section className="bg-surface-container-lowest editorial-shadow p-6 rounded-2xl space-y-6">
          <h2 className="font-headline font-bold text-xl uppercase tracking-tight text-ink">Personal Info</h2>

          {editing ? (
            <>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-underline"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="input-underline"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-2">College</label>
                <input
                  type="text"
                  value={form.college}
                  onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))}
                  className="input-underline"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-ink text-white py-4 rounded-full font-headline font-bold uppercase tracking-widest text-sm snappy hover:bg-charcoal disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Full Name', value: profile?.name || '—' },
                { label: 'Email',     value: profile?.email || '—' },
                { label: 'Phone',     value: profile?.phone || '—' },
                { label: 'College',   value: profile?.college || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="border-b border-outline-variant/30 pb-3 last:border-0 last:pb-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
                  <p className="font-body text-sm font-medium text-ink mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Student Verification */}
        <section className="bg-surface-container-lowest editorial-shadow p-6 rounded-2xl space-y-4">
          <h2 className="font-headline font-bold text-xl uppercase tracking-tight text-ink">Student Verification</h2>
          <div className={`p-4 rounded-xl ${vsStyle.bg}`}>
            <p className={`font-mono text-xs uppercase font-bold ${vsStyle.color}`}>
              Status: {vs.replace('_', ' ')}
            </p>
            {vs === 'pending' && (
              <p className="font-body text-xs text-on-surface-variant mt-1">
                Your ID is under review. We'll notify you within 24–48 hours.
              </p>
            )}
            {vs === 'verified' && (
              <p className="font-body text-xs text-green-700 mt-1">
                Your student identity has been verified.
              </p>
            )}
          </div>

          {vs !== 'verified' && vs !== 'pending' && (
            <div>
              <label className="block w-full">
                <input type="file" accept="image/*" onChange={handleCollegeIdUpload} className="hidden" />
                <div className="w-full border-2 border-dashed border-outline-variant rounded-xl p-6 text-center cursor-pointer hover:border-amber snappy">
                  <span className="material-symbols-outlined text-3xl text-muted block mb-2">upload_file</span>
                  <p className="font-body font-bold text-sm text-ink">
                    {uploadingId ? 'Uploading…' : 'Upload College ID Card'}
                  </p>
                  <p className="font-mono text-xs text-muted uppercase tracking-wider mt-1">JPG, PNG — Max 10MB</p>
                </div>
              </label>
              {uploadMsg && <p className="font-body text-sm text-on-surface-variant mt-3">{uploadMsg}</p>}
            </div>
          )}
        </section>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="w-full border border-outline-variant py-4 rounded-full font-headline uppercase tracking-widest text-sm text-on-surface-variant hover:border-tertiary hover:text-tertiary snappy"
        >
          Sign Out
        </button>

      </main>

      <BottomNav />
    </div>
  );
}
