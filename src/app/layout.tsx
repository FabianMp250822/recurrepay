
import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppProviders from '@/components/layout/app-providers';
import { AuthProvider } from '@/contexts/AuthContext';
import ThemeApplicator from '@/components/layout/ThemeApplicator';

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Default metadata. The title will be updated by ThemeApplicator on the client-side.
export const metadata: Metadata = {
  title: 'RecurPay - Pagos Recurrentes Inteligentes', // Default title
  description: 'Gestione sus clientes y automatice los pagos recurrentes.',
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
    <html lang="es" suppressHydrationWarning>
      <body className={`${openSans.variable} font-sans antialiased`}>
        <AuthProvider>
          <AppProviders>
            <ThemeApplicator />
            {children}
            <Toaster />
          </AppProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
