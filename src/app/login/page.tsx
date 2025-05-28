
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, authError, setAuthError, user, isAdmin, initialLoadComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialLoadComplete && user && isAdmin) {
      router.replace('/dashboard');
    }
  }, [user, isAdmin, router, initialLoadComplete]);
  
   useEffect(() => {
    // Clear error when component mounts or email/password changes, to avoid stale errors
    setAuthError(null);
  }, [setAuthError]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null); // Clear previous errors
    await login(email, password);
  };
  
  // If still checking auth or already logged in and admin, show loading or nothing (will redirect)
  if (!initialLoadComplete || (user && isAdmin)) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <CreditCard className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">RecurPay</CardTitle>
          <CardDescription>Administrator Login</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {authError && (
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Login Error</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
