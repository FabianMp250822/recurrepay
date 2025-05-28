
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { signOut, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase'; // Ensure db is exported from firebase.ts
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: FirebaseUser | null;
  isAdmin: boolean;
  loading: boolean;
  initialLoadComplete: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  setAuthError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setAuthError(null);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Check admin status
        try {
          const adminDocRef = doc(db, "administradores", firebaseUser.uid);
          const adminDocSnap = await getDoc(adminDocRef);
          if (adminDocSnap.exists() && adminDocSnap.data().activo === true) {
            setIsAdmin(true);
            if (pathname === '/login') {
              router.replace('/dashboard');
            }
          } else {
            setIsAdmin(false);
            await signOut(auth); // Sign out if not an active admin
            setUser(null);
            setAuthError("Access denied. You are not an authorized administrator.");
            if (pathname !== '/login') {
                 router.replace('/login');
            }
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
          await signOut(auth);
          setUser(null);
          setAuthError("Error verifying administrator privileges.");
          if (pathname !== '/login') {
            router.replace('/login');
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
         if (pathname !== '/login') {
           router.replace('/login');
         }
      }
      setLoading(false);
      setInitialLoadComplete(true);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle admin check and navigation
    } catch (error: any) {
      console.error("Login error:", error);
      let message = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
      }
      setAuthError(message);
      setUser(null);
      setIsAdmin(false);
      setLoading(false);
    }
    // setLoading(false) will be handled by onAuthStateChanged's final setLoading(false)
  };

  const logout = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      router.replace('/login');
    } catch (error) {
      console.error("Logout error:", error);
      setAuthError("Logout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!initialLoadComplete && (pathname !== '/login')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, initialLoadComplete, login, logout, authError, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
