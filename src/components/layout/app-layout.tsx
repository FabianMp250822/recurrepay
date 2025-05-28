import React from 'react';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
