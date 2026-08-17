
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, createGoogleProvider } from '@/lib/firebase';
import { ADMIN_USER_IDS } from '@/lib/constants';

const MOCK_SESSION_KEY = 'dev_mock_user_active';
const mockAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithEmail: (email: string, password: string) => Promise<unknown>;
  signInWithGoogle: () => Promise<unknown>;
  signOutUser: () => Promise<void>;
  signInMock: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const isMockSession = useRef<boolean>(false);
  const authResolved = useRef<boolean>(false);

  useEffect(() => {
    // Restore mock session only when explicitly enabled for local development.
    if (mockAuthEnabled && typeof window !== 'undefined' && sessionStorage.getItem(MOCK_SESSION_KEY)) {
      const mockUser = {
        uid: '2uVscE2nJzUoVlT2PyuH6YRm5D22',
        email: 'admin@test.com',
        displayName: 'Mock Admin',
        emailVerified: true,
      } as any;
      isMockSession.current = true;
      authResolved.current = true;
      setUser(mockUser);
      setIsAdmin(true);
      setLoading(false);
    }

    // Safety timeout: if Firebase Auth never calls back within 5s, stop loading
    const timeoutId = setTimeout(() => {
      if (!authResolved.current) {
        console.warn('Firebase Auth did not respond within 5s — stopping loader.');
        authResolved.current = true;
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // If a mock session is active, don't let Firebase override it with null
      if (isMockSession.current) return;

      authResolved.current = true;
      clearTimeout(timeoutId);
      setUser(currentUser);
      setIsAdmin(currentUser ? ADMIN_USER_IDS.includes(currentUser.uid) : false);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const signInWithEmail = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = () => {
    const provider = createGoogleProvider();
    return signInWithPopup(auth, provider);
  };

  const signOutUser = async () => {
    isMockSession.current = false;
    authResolved.current = false;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(MOCK_SESSION_KEY);
    }
    setUser(null);
    setIsAdmin(false);
    return signOut(auth);
  };

  const signInMock = () => {
    if (!mockAuthEnabled) {
      return Promise.reject(new Error('Mock auth is disabled. Set NEXT_PUBLIC_ENABLE_MOCK_AUTH=true to enable it.'));
    }

    const mockUser = {
      uid: '2uVscE2nJzUoVlT2PyuH6YRm5D22',
      email: 'admin@test.com',
      displayName: 'Mock Admin',
      emailVerified: true,
    } as any;
    isMockSession.current = true;
    authResolved.current = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MOCK_SESSION_KEY, '1');
    }
    setUser(mockUser);
    setIsAdmin(true);
    setLoading(false);
    return Promise.resolve(mockUser);
  };

  const value = {
    user,
    loading,
    isAdmin,
    signInWithEmail,
    signInWithGoogle,
    signOutUser,
    signInMock,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
