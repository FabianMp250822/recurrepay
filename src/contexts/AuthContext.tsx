
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { signOut, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase'; 
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
            await signOut(auth); 
            setUser(null);
            setAuthError("Acceso denegado. No es un administrador autorizado.");
            if (pathname !== '/login') {
                 router.replace('/login');
            }
          }
        } catch (error) {
          console.error("Error al verificar estado de administrador:", error);
          setIsAdmin(false);
          await signOut(auth);
          setUser(null);
          setAuthError("Error al verificar privilegios de administrador.");
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
    } catch (error: any) {
      console.error("Error de inicio de sesión:", error);
      let message = "Error al iniciar sesión. Por favor, verifique sus credenciales.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Correo electrónico o contraseña inválidos.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "El acceso a esta cuenta ha sido deshabilitado temporalmente debido a muchos intentos fallidos de inicio de sesión. Puede restaurarlo inmediatamente restableciendo su contraseña o puede intentarlo de nuevo más tarde.";
      }
      setAuthError(message);
      setUser(null);
      setIsAdmin(false);
      setLoading(false);
    }
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
      console.error("Error al cerrar sesión:", error);
      setAuthError("Error al cerrar sesión. Por favor, inténtelo de nuevo.");
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
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
