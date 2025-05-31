'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User, MessageCircle, Home } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const { user, client, userRole, logout, initialLoadComplete } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (initialLoadComplete && userRole !== 'client') {
      if (userRole === 'admin') {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [userRole, initialLoadComplete, router]);

  if (!initialLoadComplete || userRole !== 'client') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const navigation = [
    {
      name: 'Panel Principal',
      href: '/client-dashboard',
      icon: Home,
      current: pathname === '/client-dashboard',
    },
    {
      name: 'Mis Solicitudes',
      href: '/client-dashboard/tickets',
      icon: MessageCircle,
      current: pathname.startsWith('/client-dashboard/tickets'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <div className="font-semibold text-lg">Portal Cliente</div>
            
            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                      item.current 
                        ? 'text-primary' 
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            {client && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                <span>{client.firstName} {client.lastName}</span>
                <span className="text-muted-foreground">({user?.email})</span>
              </div>
            )}
            
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div className="md:hidden border-t bg-background">
          <nav className="flex">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors hover:text-primary ${
                    item.current 
                      ? 'text-primary bg-primary/5' 
                      : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name.split(' ')[0]} {/* Solo primera palabra en móvil */}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}