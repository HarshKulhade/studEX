'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { authApi } from '../lib/api';
import { useRouter } from 'next/navigation';

interface StudentProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  college?: string;
  isVerified: boolean;
  emailVerified: boolean;
  verificationStatus: string;
  referralCode: string;
  ambassadorTier: string;
  totalReferrals: number;
  avatarUrl?: string;
  wallet?: { balance: number; totalEarned: number };
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  student: StudentProfile | null;
  token: string | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshStudent: () => Promise<void>;
  walletBalance: number;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  student: null,
  token: null,
  loading: true,
  logout: async () => {},
  refreshStudent: async () => {},
  walletBalance: 0,
  refreshWallet: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const router = useRouter();

  // Use a ref so refreshWallet always reads the latest token without stale closure
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const refreshWallet = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/wallet`,
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      const data = await res.json();
      if (data?.data?.balance !== undefined) {
        setWalletBalance(parseFloat(data.data.balance));
      }
    } catch {
      // silently fail
    }
  }, []); // no deps — always reads latest token via ref

  const fetchStudentProfile = useCallback(async (fbUser: FirebaseUser) => {
    const attemptLogin = async (t: string): Promise<{ data: { user: StudentProfile } } | null> => {
      try {
        const res = await authApi.loginStudent(t) as { data: { user: StudentProfile } };
        if (res?.data?.user) return res;
        return null;
      } catch {
        return null;
      }
    };

    try {
      const t = await fbUser.getIdToken();
      setToken(t);
      tokenRef.current = t; // update ref immediately so refreshWallet can use it

      let res = await attemptLogin(t);

      // If first attempt fails, the user may have just registered and the backend
      // profile isn't ready yet. Retry once after a short delay.
      if (!res) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        res = await attemptLogin(t);
      }

      if (res?.data?.user) {
        setStudent(res.data.user);
      } else {
        // Backend still returned no user after retry — clear the stale Firebase session
        setStudent(null);
        await signOut(auth);
        return;
      }
      // Fetch wallet with the fresh token directly
      const walletRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/wallet`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const walletData = await walletRes.json();
      if (walletData?.data?.balance !== undefined) {
        setWalletBalance(parseFloat(walletData.data.balance));
      }
    } catch {
      // Backend profile fetch failed (e.g., 404 no account) — sign out stale Firebase session
      setStudent(null);
      setToken(null);
      tokenRef.current = null;
      await signOut(auth);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchStudentProfile(user);
      } else {
        setStudent(null);
        setToken(null);
        tokenRef.current = null;
        setWalletBalance(0);
      }
      setLoading(false);
    });
    return unsub;
  }, [fetchStudentProfile]);

  const logout = async () => {
    await signOut(auth);
    setStudent(null);
    setToken(null);
    tokenRef.current = null;
    setWalletBalance(0);
    router.push('/login');
  };

  const refreshStudent = async () => {
    if (firebaseUser) {
      await fetchStudentProfile(firebaseUser);
    }
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, student, token, loading, logout, refreshStudent, walletBalance, refreshWallet }}>
      {children}
    </AuthContext.Provider>
  );
}
