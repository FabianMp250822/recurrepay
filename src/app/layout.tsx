
import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppProviders from '@/components/layout/app-providers';
import { AuthProvider } from '@/contexts/AuthContext';

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'RecurPay - Pagos Recurrentes Inteligentes',
  description: 'Gestione sus clientes y automatice los pagos recurrentes con RecurPay.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning><body className={`${openSans.variable} font-sans antialiased`}>
        <AuthProvider>
          <AppProviders>
            {children}
            <Toaster />
          </AppProviders>
        </AuthProvider>
      </body></html>
  );
}
