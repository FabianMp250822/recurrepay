
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, LogOut, CreditCard, BarChart3 } from 'lucide-react'; // Added BarChart3 for Analytics
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/dashboard', label: 'Panel de Analíticas', icon: BarChart3 }, // Changed from LayoutDashboard
  { href: '/clients', label: 'Clientes', icon: Users }, // New link for client list
  { href: '/clients/new', label: 'Agregar Cliente', icon: Users },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout, loading, initialLoadComplete } = useAuth();

  if (!initialLoadComplete || !isAdmin || !user) {
    return null; 
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-10">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg text-sidebar-primary">
          <CreditCard className="h-6 w-6 text-primary" />
          <span>RecurPay</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => {
          // Determine if the item is active. For /clients, also check if pathname starts with /clients/
          // to keep it active for /clients/new and /clients/[id]/edit
          const isActive = item.href === '/clients' 
            ? pathname.startsWith('/clients') 
            : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/clients/new');

          // Special handling for 'Agregar Cliente' to avoid it being active when viewing '/clients' list
          if (item.href === '/clients/new' && pathname === '/clients') {
             // isActive should be false for 'Agregar Cliente' if we are on '/clients' list
          }


          return (
            <Button
              key={item.href}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                "w-full justify-start",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              asChild
            >
              <Link href={item.href}>
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src="https://placehold.co/40x40.png" alt="Avatar de Usuario" data-ai-hint="user avatar" />
            <AvatarFallback>{user.email ? user.email.substring(0,2).toUpperCase() : 'AD'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium truncate" title={user.email || 'Usuario Administrador'}>{user.email || 'Usuario Administrador'}</p>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start mt-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={logout}>
          <LogOut className="mr-3 h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  );
}
