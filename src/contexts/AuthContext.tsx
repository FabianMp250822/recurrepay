'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { isUserAdmin, getClientByEmail } from '@/lib/store';
import type { Client } from '@/types';

type UserRole = 'admin' | 'client' | null;

interface AuthContextType {
  user: User | null;
  client: Client | null;
  isAdmin: boolean;
  isClient: boolean;
  userRole: UserRole;
  loading: boolean;
  initialLoadComplete: boolean;
  authError: string | null;
  setAuthError: (error: string | null) => void; // Asegúrate de que esto esté incluido
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ['/login', '/inscribir'];

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthError(null);
        
        try {
          // Verificar si es administrador
          const adminStatus = await isUserAdmin(firebaseUser.uid);
          
          if (adminStatus) {
            // Es administrador
            setIsAdmin(true);
            setIsClient(false);
            setUserRole('admin');
            setClient(null);
            
            // Redirigir a dashboard si está en página pública
            if (PUBLIC_PATHS.includes(pathname)) {
              router.replace('/dashboard');
            }
          } else {
            // No es admin, verificar si es cliente
            const clientData = await getClientByEmail(firebaseUser.email!);
            
            if (clientData) {
              // Es cliente registrado
              setIsAdmin(false);
              setIsClient(true);
              setUserRole('client');
              setClient(clientData);
              
              // Redirigir a panel de cliente si está en página pública
              if (PUBLIC_PATHS.includes(pathname)) {
                router.replace('/client-dashboard');
              }
            } else {
              // Usuario autenticado pero sin perfil de cliente ni admin
              setIsAdmin(false);
              setIsClient(false);
              setUserRole(null);
              setClient(null);
              
              // Redirigir a completar perfil si no está en página pública
              if (!PUBLIC_PATHS.includes(pathname)) {
                router.replace('/inscribir');
              }
            }
          }
        } catch (error) {
          console.error("Error al verificar rol de usuario:", error);
          setIsAdmin(false);
          setIsClient(false);
          setUserRole(null);
          setClient(null);
          
          if (!PUBLIC_PATHS.includes(pathname)) {
            await signOut(auth);
            setUser(null);
            setAuthError("Error al verificar permisos de usuario.");
            router.replace('/login');
          }
        }
      } else {
        // Usuario no autenticado
        setUser(null);
        setClient(null);
        setIsAdmin(false);
        setIsClient(false);
        setUserRole(null);
        
        // Redirigir a login si no está en ruta pública
        if (!PUBLIC_PATHS.includes(pathname)) {
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
      // onAuthStateChanged manejará la redirección
    } catch (error: any) {
      setAuthError(error.message || 'Error al iniciar sesión');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setClient(null);
      setIsAdmin(false);
      setIsClient(false);
      setUserRole(null);
      setAuthError(null);
      router.replace('/login');
    } catch (error: any) {
      setAuthError(error.message || 'Error al cerrar sesión');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        client,
        isAdmin,
        isClient,
        userRole,
        loading,
        initialLoadComplete,
        authError,
        setAuthError, // Asegúrate de incluir esto en el value
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
