
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
  setAuthError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // ✅ Mantener esta función aunque no la usemos en el server action
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ['/', '/login', '/inscribir']; // Added '/'

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

  // ✅ Función para obtener el token de autenticación
  const getAuthToken = async (): Promise<string | null> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn('No hay usuario autenticado para obtener token');
        return null;
      }
      
      const token = await currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error('Error al obtener token de autenticación:', error);
      return null;
    }
  };

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
            
            // Redirigir a dashboard si está en página pública (login, inscribir).
            // No redirigir desde '/' si ya está autenticado como admin, la landing page tiene un botón "Ir al Panel"
            if (pathname === '/login' || pathname === '/inscribir') {
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
              
              // Redirigir a panel de cliente si está en página pública (login, inscribir).
              // No redirigir desde '/' si ya está autenticado como cliente.
              if (pathname === '/login' || pathname === '/inscribir') {
                router.replace('/client-dashboard');
              }
            } else {
              // Usuario autenticado pero sin perfil de cliente ni admin
              setIsAdmin(false);
              setIsClient(false);
              setUserRole(null);
              setClient(null);
              
              // Redirigir a completar perfil si no está en página pública (incluyendo '/')
              // o si está en la landing pero sin perfil.
              if (!PUBLIC_PATHS.includes(pathname) || pathname === '/') {
                 // Permitir que el flujo de /inscribir continúe si ya está autenticado pero sin perfil.
                if (pathname !== '/inscribir') {
                    router.replace('/inscribir');
                }
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
      router.replace('/login'); // Redirige a /login al cerrar sesión
    } catch (error: any) {
      setAuthError(error.message || 'Error al cerrar sesión');
    }
  };

  const value = {
    user,
    client,
    isAdmin,
    isClient,
    userRole,
    loading,
    initialLoadComplete,
    authError,
    setAuthError,
    login,
    logout,
    getAuthToken, // ✅ Incluir la función
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
