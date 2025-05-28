
import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppProviders from '@/components/layout/app-providers';
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'RecurPay - Smart Recurring Payments',
  description: 'Manage your clients and automate recurring payments with RecurPay.',
  icons: {
    icon: '/favicon.ico', // Placeholder, actual favicon not generated
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${openSans.variable} font-sans antialiased`}>
        <AuthProvider> {/* Wrap AppProviders (and thus children) with AuthProvider */}
          <AppProviders>
            {children}
            <Toaster />
          </AppProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
