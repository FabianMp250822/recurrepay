
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, CreditCard, Users, Settings, BarChart3, ShieldCheck, Zap, MailCheck } from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter
import React, { useEffect } from 'react'; // Import useEffect

const features = [
  {
    icon: <Users className="h-10 w-10 text-primary mb-4" />,
    title: 'Gestión de Clientes Simplificada',
    description: 'Cree, edite y organice fácilmente los perfiles de sus clientes, incluyendo sus detalles de contacto y configuraciones de pago.',
  },
  {
    icon: <CreditCard className="h-10 w-10 text-primary mb-4" />,
    title: 'Pagos Recurrentes Automatizados',
    description: 'Configure montos de pago y fechas. RecurPay se encarga del resto, asegurando cobros puntuales y sin esfuerzo.',
  },
  {
    icon: <Settings className="h-10 w-10 text-primary mb-4" />,
    title: 'Configuración Flexible de Pagos',
    description: 'Defina el valor del contrato, si aplica IVA, porcentajes de abono y elija entre múltiples planes de financiación.',
  },
  {
    icon: <MailCheck className="h-10 w-10 text-primary mb-4" />,
    title: 'Recordatorios Inteligentes con IA',
    description: 'Genere asuntos de correo electrónico efectivos y personalizados para recordatorios de pago, optimizados por IA.',
  },
  {
    icon: <BarChart3 className="h-10 w-10 text-primary mb-4" />,
    title: 'Panel de Analíticas Detallado',
    description: 'Obtenga información valiosa sobre sus ingresos, proyecciones, crecimiento de clientes y estado de pagos.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary mb-4" />,
    title: 'Plataforma Segura y Confiable',
    description: 'Sus datos y los de sus clientes están protegidos con las mejores prácticas de seguridad.',
  },
];

export default function LandingPage() {
  const { user, isAdmin, initialLoadComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si el usuario ya está autenticado y es admin, redirigir al dashboard
    // Si es cliente, AuthContext o ClientLayout se encargarán de redirigir a /client-dashboard
    if (initialLoadComplete && user) {
      if (isAdmin) {
        router.replace('/dashboard');
      } else {
        // Si es un usuario no-admin (cliente), ClientLayout lo llevará a /client-dashboard
        // O si no tiene perfil, AuthContext lo podría llevar a /inscribir.
        // Esta página (/) es pública, así que si el usuario autenticado no es admin,
        // y no es un cliente que deba ir a su panel, puede quedarse aquí (aunque es raro).
        // La lógica de AppLayout y AuthContext usualmente maneja las redirecciones de usuarios autenticados.
      }
    }
  }, [user, isAdmin, initialLoadComplete, router]);


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <LandingHeader />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-background to-secondary/30">
          <div className="container mx-auto px-6 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-fade-in-down">
              Automatiza Tus Cobros Recurrentes con <span className="text-primary">RecurPay</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto animate-fade-in-up">
              Simplifica la gestión de clientes y pagos, optimiza tu flujo de caja y dedica más tiempo a hacer crecer tu negocio.
            </p>
            <div className="space-x-4 animate-fade-in-up animation-delay-300">
              <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/inscribir">Comienza Ahora</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#features">Conocer Más</Link>
              </Button>
            </div>
             <div className="mt-16 animate-fade-in-up animation-delay-500">
              <Image
                src="https://placehold.co/1000x500.png"
                alt="Dashboard de RecurPay"
                width={1000}
                height={500}
                className="rounded-xl shadow-2xl mx-auto"
                data-ai-hint="dashboard software payments"
                priority
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">Todo lo que Necesitas en un Solo Lugar</h2>
              <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
                RecurPay te ofrece herramientas poderosas para gestionar tus suscripciones y pagos recurrentes de manera eficiente.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="items-center text-center">
                    {feature.icon}
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 md:py-24 bg-secondary/30">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">Simple y Poderoso</h2>
              <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">Comienza a gestionar tus pagos en 3 simples pasos.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="space-y-4">
                <div className="p-4 bg-primary rounded-full inline-block text-primary-foreground">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold">1. Registra Clientes</h3>
                <p className="text-muted-foreground">Añade tus clientes y configura sus planes de pago y detalles contractuales de forma rápida.</p>
              </div>
              <div className="space-y-4">
                 <div className="p-4 bg-primary rounded-full inline-block text-primary-foreground">
                  <Zap className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold">2. Automatiza Cobros</h3>
                <p className="text-muted-foreground">Define la recurrencia y deja que RecurPay envíe recordatorios y gestione los cobros por ti.</p>
              </div>
              <div className="space-y-4">
                 <div className="p-4 bg-primary rounded-full inline-block text-primary-foreground">
                  <BarChart3 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold">3. Analiza y Crece</h3>
                <p className="text-muted-foreground">Monitorea tus ingresos, proyecciones y el comportamiento de tus clientes con nuestro panel de analíticas.</p>
              </div>
            </div>
          </div>
        </section>


        {/* CTA Section */}
        <section className="py-20 md:py-28 bg-background">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              ¿Listo para Transformar tu Gestión de Cobros?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Únete a RecurPay y descubre una forma más inteligente de administrar tus pagos recurrentes.
            </p>
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/inscribir">Regístrate Gratis</Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
