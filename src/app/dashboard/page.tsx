
'use client'; // Make this a Client Component

import Link from 'next/link';
import { PlusCircle, Edit3, Users as UsersIconLucide, FileText, DollarSign, LinkIcon, Loader2, Terminal, Landmark, TrendingUp, CalendarClock, UserX, CreditCard as CreditCardIcon, AlertCircle } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/layout/app-layout';
import { getClients } from '@/lib/store';
import { formatDate, formatCurrency, getDaysUntilDue } from '@/lib/utils';
import DeleteClientDialog from '@/components/clients/delete-client-dialog';
import SendReminderButton from '@/components/clients/SendReminderButton';
import type { Client } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FINANCING_OPTIONS } from '@/lib/constants';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { isSameMonth, isSameYear, getMonth, getYear, startOfToday } from 'date-fns';

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin, initialLoadComplete } = useAuth();

  const fetchClientsCallback = useCallback(async () => {
    if (!isAdmin) {
        setError("Acceso denegado. No tiene permisos para ver esta información.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedClients = await getClients();
      setClients(fetchedClients);
    } catch (err: any) {
      console.error("Error fetching clients on dashboard. AuthContext state: ", { userUid: user?.uid, isAdminContext: isAdmin, initialLoadCompleteContext: initialLoadComplete }, err);
      const detailedError = err.message || 'Error al cargar los clientes. Por favor, inténtelo de nuevo.';
      setError(detailedError.includes("permission denied") || detailedError.includes("Permiso denegado") ? "Permiso denegado por Firestore al buscar clientes. Asegúrese de que las reglas de seguridad de Firebase permitan el acceso de lectura a la colección 'listapagospendiendes' para administradores autenticados y activos, y que su cuenta de administrador esté configurada correctamente con el estado 'activo: true'." : detailedError);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user?.uid, initialLoadComplete]);

  useEffect(() => {
    if (initialLoadComplete) {
      if (isAdmin) {
        fetchClientsCallback();
      } else {
        setError("Acceso denegado. No es un administrador autorizado.");
        setIsLoading(false);
        setClients([]);
      }
    } else {
      setIsLoading(true);
    }
  }, [initialLoadComplete, isAdmin, fetchClientsCallback]);

  const statistics = useMemo(() => {
    if (!clients || clients.length === 0) {
      return {
        totalPendingCollection: 0,
        estimatedTaxes: 0,
        currentMonthProjection: 0,
        currentYearProjection: 0,
        clientsInArrearsCount: 0,
        totalOverdueAmount: 0,
      };
    }

    const today = startOfToday();
    const currentMonth = getMonth(today);
    const currentYear = getYear(today);

    let totalPendingCollection = 0;
    let estimatedTaxes = 0;
    let currentMonthProjection = 0;
    let currentYearProjection = 0;
    let clientsInArrearsCount = 0;
    let totalOverdueAmount = 0;

    clients.forEach(client => {
      if (client.paymentAmount > 0) {
        totalPendingCollection += client.paymentAmount;

        const nextPaymentDate = new Date(client.nextPaymentDate);
        if (isSameMonth(nextPaymentDate, today) && isSameYear(nextPaymentDate, today)) {
          currentMonthProjection += client.paymentAmount;
        }
        if (isSameYear(nextPaymentDate, today)) {
          currentYearProjection += client.paymentAmount;
        }

        if (getDaysUntilDue(client.nextPaymentDate) < 0) {
          clientsInArrearsCount++;
          totalOverdueAmount += client.paymentAmount;
        }
      }

      if (client.contractValue && client.contractValue > 0 && client.paymentAmount > 0 && client.ivaAmount) {
        estimatedTaxes += client.ivaAmount;
      }
    });

    return {
      totalPendingCollection,
      estimatedTaxes,
      currentMonthProjection,
      currentYearProjection,
      clientsInArrearsCount,
      totalOverdueAmount,
    };
  }, [clients]);


  function getPaymentStatusBadge(nextPaymentDate: string): React.ReactElement {
    const daysUntil = getDaysUntilDue(nextPaymentDate);
    if (daysUntil < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (daysUntil <= 3) {
      return <Badge className="bg-yellow-500 text-black hover:bg-yellow-600 dark:bg-yellow-600 dark:text-white dark:hover:bg-yellow-700">Vence Pronto</Badge>;
    }
    if (daysUntil <= 7) {
      return <Badge variant="secondary">Próximo</Badge>;
    }
    return <Badge variant="outline">Programado</Badge>;
  }

  if (isLoading && initialLoadComplete) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Cargando clientes...</p>
        </div>
      </AppLayout>
    );
  }

  if (error && initialLoadComplete) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error al Cargar Clientes</AlertTitle>
          <AlertDescription>
            {error}
             {error.toLowerCase().includes("permission denied") || error.toLowerCase().includes("permiso denegado") ? (
                 <p className="mt-2 text-xs">Asegúrese de que las reglas de seguridad de Firestore permitan el acceso de lectura a la colección 'listapagospendiendes' para administradores autenticados y activos, y que su cuenta de administrador esté configurada correctamente con el estado 'activo: true'.</p>
            ) : null}
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!initialLoadComplete || !isAdmin) {
    return (
         <AppLayout>
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Verificando acceso...</p>
            </div>
        </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Panel de Control RecurPay</h1>
          <p className="text-muted-foreground">Resumen financiero y gestión de clientes.</p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Nuevo Cliente
          </Link>
        </Button>
      </div>

      {/* Statistics Panel */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recaudación Pendiente General</CardTitle>
            <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalPendingCollection)}</div>
            <p className="text-xs text-muted-foreground">Suma de todas las próximas cuotas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impuestos Estimados (IVA Contratos)</CardTitle>
            <Landmark className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.estimatedTaxes)}</div>
            <p className="text-xs text-muted-foreground">IVA total de contratos con financiación activa</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyección Recaudo Mes Actual</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.currentMonthProjection)}</div>
            <p className="text-xs text-muted-foreground">Próximas cuotas este mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyección Recaudo Año Actual</CardTitle>
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.currentYearProjection)}</div>
            <p className="text-xs text-muted-foreground">Próximas cuotas este año</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes en Mora</CardTitle>
            <UserX className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.clientsInArrearsCount}</div>
            <p className="text-xs text-muted-foreground">Clientes con pagos vencidos</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total Vencido</CardTitle>
            <AlertCircle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalOverdueAmount)}</div>
            <p className="text-xs text-muted-foreground">Suma de cuotas vencidas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            Una lista de todos los clientes registrados, su información de pago y detalles de financiación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 && !isLoading ? (
            <div className="text-center py-10">
              <UsersIconLucide className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No se encontraron clientes</h3>
              <p className="mt-1 text-sm text-muted-foreground">Comience agregando un nuevo cliente.</p>
              <div className="mt-6">
                <Button asChild>
                  <Link href="/clients/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Nuevo Cliente
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre Completo</TableHead>
                <TableHead className="hidden md:table-cell">Correo Electrónico</TableHead>
                <TableHead className="text-right">Cuota Mensual</TableHead>
                <TableHead className="hidden sm:table-cell">Plan Financiación</TableHead>
                <TableHead className="hidden lg:table-cell">Documentos</TableHead>
                <TableHead className="hidden sm:table-cell">Próximo Pago</TableHead>
                <TableHead className="hidden sm:table-cell text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client: Client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="font-medium">{client.firstName} {client.lastName}</div>
                    <div className="text-xs text-muted-foreground md:hidden">{client.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{client.email}</TableCell>
                  <TableCell className="text-right">
                    {client.paymentAmount > 0 ? formatCurrency(client.paymentAmount) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {client.financingPlan && client.financingPlan !== 0 && FINANCING_OPTIONS[client.financingPlan]
                      ? FINANCING_OPTIONS[client.financingPlan].label
                      : client.contractValue && client.contractValue > 0 ? <span className="text-muted-foreground">Pago único</span> : <span className="text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-col gap-1 text-xs">
                      {client.acceptanceLetterUrl && (
                        <a href={client.acceptanceLetterUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          <LinkIcon size={12} /> Carta Acept.
                        </a>
                      )}
                      {client.contractFileUrl && (
                         <a href={client.contractFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          <LinkIcon size={12} /> Contrato
                        </a>
                      )}
                       {(!client.acceptanceLetterUrl && !client.contractFileUrl) && <span className="text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(client.nextPaymentDate)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-center">
                    {client.paymentAmount > 0 ? getPaymentStatusBadge(client.nextPaymentDate) : <Badge variant="outline">Completado</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" asChild>
                              <Link href={`/clients/${client.id}/edit`}>
                                <Edit3 className="h-4 w-4" />
                                 <span className="sr-only">Editar Cliente</span>
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Editar Cliente</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {client.paymentAmount > 0 && <SendReminderButton client={client} />}
                      <DeleteClientDialog clientId={client.id} clientName={`${client.firstName} ${client.lastName}`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
         {clients.length > 0 && (
          <CardFooter className="text-xs text-muted-foreground">
            Mostrando <strong>{clients.length}</strong> cliente(s).
          </CardFooter>
        )}
      </Card>
    </AppLayout>
  );
}
