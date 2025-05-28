
'use client';

import Link from 'next/link';
import { CreditCard, Menu, Users, LogOut, BarChart3 } from 'lucide-react'; // Added BarChart3
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/dashboard', label: 'Panel de Analíticas', icon: BarChart3 },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/clients/new', label: 'Agregar Cliente', icon: Users },
];


export function AppHeader() {
  const pathname = usePathname();
  const { user, isAdmin, logout, loading, initialLoadComplete } = useAuth();

  const getPageTitle = () => {
    if (pathname === ('/dashboard')) return 'Panel de Analíticas';
    if (pathname === ('/clients')) return 'Lista de Clientes';
    if (pathname.startsWith('/clients/new')) return 'Crear Nuevo Cliente';
    if (pathname.match(/^\/clients\/[^/]+\/edit$/)) return 'Editar Cliente';
    if (pathname.startsWith('/login')) return 'Inicio de Sesión de Administrador';
    return 'RecurPay';
  };
  
  if (!initialLoadComplete || (!isAdmin && pathname !== '/login')) {
    if (loading && pathname !== '/login') return null; 
    if (!isAdmin && pathname !== '/login') return null; 
  }


  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
      {isAdmin && user && ( 
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Alternar Menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs bg-sidebar text-sidebar-foreground">
            <nav className="grid gap-4 text-lg font-medium p-2">
              <Link
                href="/dashboard"
                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base mb-4"
              >
                <CreditCard className="h-5 w-5 transition-all group-hover:scale-110" />
                <span className="sr-only">RecurPay</span>
              </Link>
              {navItems.map((item) => {
                  const isActive = item.href === '/clients' 
                    ? pathname.startsWith('/clients') 
                    : pathname === item.href;
                return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-4 px-2.5 py-2 rounded-lg ${
                      isActive
                        ? 'text-sidebar-accent-foreground bg-sidebar-accent'
                        : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </SheetClose>
                );
              })}
                 <SheetClose asChild>
                    <Button onClick={logout} variant="ghost" className="flex items-center gap-4 px-2.5 py-2 rounded-lg text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent justify-start">
                        <LogOut className="h-5 w-5" />
                        Cerrar Sesión
                    </Button>
                </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      )}
      
      <div className="relative ml-auto flex-1 md:grow-0">
        {/* Search can be added later if needed */}
      </div>
       <h1 className="text-xl font-semibold md:text-2xl flex-1 lg:ml-4">{getPageTitle()}</h1>
      
      {isAdmin && user && ( 
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://placehold.co/40x40.png" alt="Avatar de Usuario" data-ai-hint="user avatar" />
                <AvatarFallback>{user.email ? user.email.substring(0, 2).toUpperCase() : 'RP'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.email || 'Mi Cuenta'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* <DropdownMenuItem>Configuración</DropdownMenuItem>
            <DropdownMenuItem>Soporte</DropdownMenuItem>
            <DropdownMenuSeparator /> */}
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
