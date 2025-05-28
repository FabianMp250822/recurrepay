
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, isAdmin, initialLoadComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialLoadComplete) {
      if (user && isAdmin) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isAdmin, initialLoadComplete, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
