
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
  display: 'swap', // Added for font display strategy
});

// Default metadata. The title will be updated by ThemeApplicator on the client-side.
// For the landing page, we can also set a specific title here.
export const metadata: Metadata = {
  title: 'RecurPay - Automatización Inteligente de Pagos Recurrentes', // Updated default title
  description: 'Simplifica la gestión de clientes y pagos recurrentes con RecurPay. Automatiza cobros, configura planes de financiación y optimiza tu flujo de caja.',
  keywords: 'pagos recurrentes, gestión de suscripciones, automatización de cobros, software de facturación, RecurPay, SaaS, finanzas',
  openGraph: {
    title: 'RecurPay - Automatización Inteligente de Pagos Recurrentes',
    description: 'Descubre cómo RecurPay puede transformar la gestión de tus pagos recurrentes y suscripciones.',
    type: 'website',
    // url: 'https://www.recurpay.app', // Replace with your actual domain
    // images: [ // Replace with your actual OG image URL
    //   {
    //     url: 'https://www.recurpay.app/og-image.png',
    //     width: 1200,
    //     height: 630,
    //     alt: 'RecurPay Dashboard',
    //   },
    // ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RecurPay - Automatización Inteligente de Pagos Recurrentes',
    description: 'Simplifica la gestión de clientes y pagos recurrentes con RecurPay.',
    // images: ['https://www.recurpay.app/twitter-image.png'], // Replace with your actual Twitter image URL
  },
  icons: {
    icon: '/favicon.ico', // Ensure you have a favicon.ico in your public folder
    // apple: '/apple-touch-icon.png', // For Apple touch icon
  },
  // viewport: 'width=device-width, initial-scale=1', // Usually handled by Next.js
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
            <ThemeApplicator /> {/* Applies theme and potentially updates title client-side */}
            {children}
            <Toaster />
          </AppProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
