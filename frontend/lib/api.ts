// Central API client for all backend requests
// Uses Firebase token for student auth, JWT for vendor auth

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ── Generic fetch with Firebase token ──────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `API error ${res.status}`);
  }

  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  registerStudent: (token: string, body: object) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }, token),

  loginStudent: (token: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({}) }, token),
};

// ── Student ───────────────────────────────────────────────────────────────

export const studentApi = {
  getProfile: (token: string) =>
    apiFetch('/api/student/profile', {}, token),

  updateProfile: (token: string, body: object) =>
    apiFetch('/api/student/profile', { method: 'PUT', body: JSON.stringify(body) }, token),

  getDashboard: (token: string) =>
    apiFetch('/api/student/dashboard', {}, token),

  getReferrals: (token: string) =>
    apiFetch('/api/student/referrals', {}, token),

  uploadCollegeId: async (token: string, formData: FormData) => {
    const res = await fetch(`${API_URL}/api/student/upload-college-id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  uploadAvatar: async (token: string, formData: FormData) => {
    const res = await fetch(`${API_URL}/api/student/upload-avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },
};

// ── Deals ─────────────────────────────────────────────────────────────────

export const dealApi = {
  getNearbyDeals: (token: string, params: {
    lat: number;
    lng: number;
    radius?: number;
    category?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      radius: String(params.radius || 2000),
      ...(params.category ? { category: params.category } : {}),
      page: String(params.page || 1),
      limit: String(params.limit || 20),
    });
    return apiFetch(`/api/deals/nearby?${q}`, {}, token);
  },

  getDealById: (token: string, id: string) =>
    apiFetch(`/api/deals/${id}`, {}, token),

  getAllDeals: (token: string, params?: { category?: string; page?: number; limit?: number }) => {
    // Fallback: fetch without location for a broad listing
    const q = new URLSearchParams({
      lat: '0',
      lng: '0',
      radius: '999999',
      ...(params?.category ? { category: params.category } : {}),
      page: String(params?.page || 1),
      limit: String(params?.limit || 20),
    });
    return apiFetch(`/api/deals/nearby?${q}`, {}, token);
  },
};

// ── Redemptions ───────────────────────────────────────────────────────────

export const redemptionApi = {
  redeemDeal: (token: string, dealId: string) =>
    apiFetch('/api/redemptions', { method: 'POST', body: JSON.stringify({ dealId }) }, token),

  getMyRedemptions: (token: string) =>
    apiFetch('/api/redemptions/my', {}, token),
};

// ── Wallet ────────────────────────────────────────────────────────────────

export const walletApi = {
  getWallet: (token: string) =>
    apiFetch('/api/wallet', {}, token),

  getTransactions: (token: string, page = 1) =>
    apiFetch(`/api/wallet/transactions?page=${page}&limit=20`, {}, token),

  withdraw: (token: string, body: { amount: number; upiId: string }) =>
    apiFetch('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify(body) }, token),

  setUpi: (token: string, upiId: string) =>
    apiFetch('/api/wallet/set-upi', { method: 'POST', body: JSON.stringify({ upiId }) }, token),

  createRazorpayOrder: (token: string, body: { amount: number }) =>
    apiFetch('/api/wallet/create-razorpay-order', { method: 'POST', body: JSON.stringify(body) }, token),

  verifyRazorpayPayment: (token: string, body: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: number;
  }) => apiFetch('/api/wallet/verify-payment', { method: 'POST', body: JSON.stringify(body) }, token),
};

// ── Opportunities ─────────────────────────────────────────────────────────

export const opportunityApi = {
  getOpportunities: (params?: { type?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams({
      ...(params?.type ? { type: params.type } : {}),
      page: String(params?.page || 1),
      limit: String(params?.limit || 20),
    });
    return apiFetch(`/api/opportunities?${q}`);
  },

  getById: (id: string) =>
    apiFetch(`/api/opportunities/${id}`),
};
