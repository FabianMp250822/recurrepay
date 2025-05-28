
'use client'; // Make this a Client Component

import Link from 'next/link';
import { PlusCircle, Edit3, Users as UsersIconLucide, FileText, DollarSign, LinkIcon, Loader2, Terminal } from 'lucide-react'; // Renamed UsersIcon to UsersIconLucide
import React, { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin, initialLoadComplete } = useAuth(); // Get auth state

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
      setError(err.message || 'Error al cargar los clientes. Por favor, inténtelo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user?.uid, initialLoadComplete]); // Dependencies for useCallback

  useEffect(() => {
    if (initialLoadComplete) {
      if (isAdmin) {
        fetchClientsCallback();
      } else {
        // This case should ideally be handled by AppLayout redirecting,
        // but as a safeguard:
        setError("Acceso denegado. No es un administrador autorizado.");
        setIsLoading(false);
        setClients([]); // Clear any stale client data
      }
    } else {
      // Still waiting for auth context to initialize
      setIsLoading(true);
    }
  }, [initialLoadComplete, isAdmin, fetchClientsCallback]); // useEffect dependencies

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

  if (isLoading && initialLoadComplete) { // Show specific loader if auth is complete but data is loading
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Cargando clientes...</p>
        </div>
      </AppLayout>
    );
  }
  
  // If initialLoadComplete is false, AppLayout will show its own loader or redirect.
  // This component's content should only attempt to render meaningful UI once auth is resolved.

  if (error && initialLoadComplete) { // Show error if auth is complete and an error occurred
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
  
  // Only render the main dashboard content if auth is complete, user is admin, and not loading & no error
  if (!initialLoadComplete || !isAdmin) {
    // This state should ideally be caught by AppLayout or the error/loading states above.
    // If somehow reached, show a generic loading or wait for redirect.
    // AppLayout handles redirects and global loading, so this might be redundant
    // or could show a more specific "Checking permissions..." message if AppLayout hasn't redirected yet.
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
          <h1 className="text-2xl font-semibold">Gestión de Clientes</h1>
          <p className="text-muted-foreground">Ver, administrar y agregar nuevos clientes y sus planes de pago.</p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Nuevo Cliente
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            Una lista de todos los clientes registrados, su información de pago y detalles de financiación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 && !isLoading ? ( // Ensure not loading when showing "no clients"
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

// Removed the local UsersIcon component as lucide-react Users (UsersIconLucide) is imported.
// If you were using a custom Users icon, ensure UsersIconLucide meets your needs or re-add the custom SVG.
// For this change, I've assumed you want to use the lucide icon.
// The import was `import { PlusCircle, Edit3, UsersIcon as Users ...}`
// I changed `Users` to `UsersIconLucide` in imports and used `UsersIconLucide` in the JSX for clarity.
// If the original Users was meant to be the custom SVG, that was an oversight in previous steps that it was still there.
// Given the error, it's unlikely related to the icon, but good to keep imports clean.
// The error `Error fetching clients from Firestore` points to data fetching.

// Note: The previous custom UsersIcon SVG component was removed.
// Using `UsersIconLucide` from `lucide-react` for the "No clients found" placeholder.
// If you had a specific reason for the custom SVG, it would need to be re-added or the import aliased carefully.

