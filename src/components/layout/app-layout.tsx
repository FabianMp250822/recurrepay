
'use client';
import React from 'react';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, initialLoadComplete } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (initialLoadComplete && (!user || !isAdmin) && pathname !== '/login') {
      router.replace('/login');
    }
  }, [user, isAdmin, initialLoadComplete, pathname, router]);

  if (!initialLoadComplete || loading) {
    // Show a loading spinner for the entire layout if auth state is still loading,
    // unless on the login page itself which has its own loader.
    if (pathname !== '/login') {
        return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        );
    }
  }
  
  // If not admin and not on the login page, AppLayout shouldn't render its content,
  // as the user will be redirected by the useEffect above or middleware.
  // Or, if on login page, children (LoginPage) will render without AppSidebar/AppHeader.
  if (pathname === '/login') {
    return <>{children}</>; // Render only login page content without the layout
  }

  // If authenticated as admin, render the full app layout
  if (user && isAdmin) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4 lg:pl-64"> {/* Adjusted pl for sidebar width */}
          <AppHeader />
          <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Fallback for edge cases or while redirecting
  if (pathname !== '/login') {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        );
  }
  return null; // Should be redirected
}
