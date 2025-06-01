'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Users as UsersIconLucide, Search, Filter, Loader2, Terminal, MessageSquare, Calendar, Link as LinkIconLucide } from 'lucide-react';
import { getDaysUntilDue, formatDate, formatCurrency, cleanPhoneNumberForWhatsApp } from '@/lib/utils';
import AppLayout from '@/components/layout/app-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Client } from '@/types';
import { getFinancingOptionsMap, getGeneralSettings, type FinancingOptionsMap } from '@/lib/store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClients } from '@/hooks/use-clients';
import RegisterPaymentButton from '@/components/clients/RegisterPaymentButton';
import SendReminderButton from '@/components/clients/SendReminderButton';

import DeleteClientDialog from '@/components/clients/delete-client-dialog';
import Link from 'next/link';
import EditClientButton from '@/components/clients/EditClientButton';

type PaymentStatusFilter = "todos" | "al_dia" | "vence_pronto" | "vencido" | "completado";

export default function ClientsListPage() {
  // ✅ Usar el hook personalizado para clientes
  const { 
    clients, 
    isLoading: clientsLoading, 
    error: clientsError, 
    loadClients,
    updateClientOptimistic,
    deleteClientOptimistic,
    revertClients
  } = useClients();

  const [searchTerm, setSearchTerm] = useState('');
  const { user, isAdmin, initialLoadComplete } = useAuth();
  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMap>({});
  const [appName, setAppName] = useState('RecurPay');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("todos");
  const [financingPlanFilter, setFinancingPlanFilter] = useState<string>("todos");

  // ✅ Cargar datos iniciales
  const fetchInitialData = useCallback(async () => {
    if (!initialLoadComplete || !isAdmin) {
      return;
    }

    try {
      const [finOptions, generalSettings] = await Promise.all([
        getFinancingOptionsMap(),
        getGeneralSettings()
      ]);
      
      setFinancingOptions(finOptions);
      if (generalSettings?.appName) {
        setAppName(generalSettings.appName);
      }
      
      // Cargar clientes
      await loadClients();
    } catch (err: any) {
      console.error('Error fetching initial data:', err);
    }
  }, [initialLoadComplete, isAdmin, loadClients]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // ✅ Callback para manejar actualizaciones de cliente
  const handleClientUpdate = useCallback((clientId: string, updates: Partial<Client>) => {
    updateClientOptimistic(clientId, updates);
  }, [updateClientOptimistic]);

  // ✅ Callback para manejar eliminación de cliente
  const handleClientDelete = useCallback((clientId: string) => {
    const originalClients = [...clients];
    
    // Actualización optimista
    deleteClientOptimistic(clientId);
    
    // En caso de error, podrías revertir los cambios
    // revertClients(originalClients);
  }, [clients, deleteClientOptimistic]);

  const filteredClients = useMemo(() => {
    let filtered = clients;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(client => 
        client.firstName.toLowerCase().includes(lowerSearchTerm) ||
        client.lastName.toLowerCase().includes(lowerSearchTerm) ||
        client.email.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Filtrar por estado de pago
    if (paymentStatusFilter !== "todos") {
      filtered = filtered.filter(client => {
        const daysUntil = getDaysUntilDue(client.nextPaymentDate);
        const isCompleted = client.status === 'completed' || (client.paymentAmount === 0 && client.status !== 'active');

        if (paymentStatusFilter === "completado") return isCompleted;
        if (isCompleted) return false;

        if (paymentStatusFilter === "al_dia") return daysUntil > 7;
        if (paymentStatusFilter === "vence_pronto") return daysUntil >= 0 && daysUntil <= 7;
        if (paymentStatusFilter === "vencido") return daysUntil < 0;
        return true;
      });
    }

    // Filtrar por plan de financiación
    if (financingPlanFilter !== "todos") {
      const planKey = parseInt(financingPlanFilter, 10);
      filtered = filtered.filter(client => client.financingPlan === planKey);
    }

    return filtered;
  }, [clients, searchTerm, paymentStatusFilter, financingPlanFilter]);

  function getPaymentStatusBadge(client: Client): React.ReactElement {
    const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);
    const isCompleted = client.status === 'completed' || (client.paymentAmount === 0 && client.status !== 'active');

    if (isCompleted) {
      return <Badge variant="secondary">Completado</Badge>;
    }
    if (daysUntilDue < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (daysUntilDue >= 0 && daysUntilDue <= 7) {
      return <Badge variant="outline">Vence Pronto</Badge>;
    }
    return <Badge variant="default">Al día</Badge>;
  }

  const generateWhatsAppLink = (client: Client) => {
    const cleanedPhoneNumber = cleanPhoneNumberForWhatsApp(client.phoneNumber);
    if (!cleanedPhoneNumber) return "#";

    const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);
    const paymentAmountFormatted = formatCurrency(client.paymentAmount);
    const nextPaymentDateFormatted = formatDate(client.nextPaymentDate);
    let message = "";

    if (daysUntilDue > 1 && daysUntilDue <= 5) {
      message = `Hola ${client.firstName}, te escribimos de ${appName} para recordarte amablemente sobre tu próximo pago de ${paymentAmountFormatted} con fecha de vencimiento el ${nextPaymentDateFormatted}. ¡Gracias!`;
    } else if (daysUntilDue === 1) {
      message = `Hola ${client.firstName}, de parte de ${appName}, este es un recordatorio amigable de que tu pago de ${paymentAmountFormatted} vence mañana, ${nextPaymentDateFormatted}. Agradecemos tu atención. ¡Saludos!`;
    } else if (daysUntilDue === 0) {
      message = `Hola ${client.firstName}, esperamos que tengas un excelente día. Te contactamos de ${appName} para recordarte que tu pago de ${paymentAmountFormatted} vence hoy, ${nextPaymentDateFormatted}. Si ya realizaste el pago, puedes ignorar este mensaje. Si tienes alguna consulta, estamos a tu disposición. ¡Gracias!`;
    } else if (daysUntilDue < 0 && daysUntilDue >= -5) {
      message = `Hola ${client.firstName}, te contactamos de ${appName} en relación a tu pago de ${paymentAmountFormatted} que venció el ${nextPaymentDateFormatted}. Entendemos que pueden surgir imprevistos. Si necesitas asistencia o deseas confirmar tu pago, por favor comunícate con nosotros. ¡Gracias!`;
    } else {
      message = `Hola ${client.firstName}, te recordamos de ${appName} sobre tu pago de ${paymentAmountFormatted} programado para el ${nextPaymentDateFormatted}. ¡Saludos!`;
    }

    return `https://wa.me/${cleanedPhoneNumber}?text=${encodeURIComponent(message)}`;
  };

  if (!initialLoadComplete) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Verificando acceso...</p>
        </div>
      </AppLayout>
    );
  }

  if (clientsLoading && initialLoadComplete) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Cargando clientes...</p>
        </div>
      </AppLayout>
    );
  }

  if (clientsError && initialLoadComplete) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error al Cargar Clientes</AlertTitle>
          <AlertDescription>
            {clientsError}
            {clientsError.toLowerCase().includes("permission denied") || clientsError.toLowerCase().includes("permiso denegado") ? (
              <p className="mt-2 text-xs">Asegúrese de que las reglas de seguridad de Firestore permitan el acceso de lectura requerido y que su cuenta de administrador esté configurada correctamente.</p>
            ) : null}
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!isAdmin && initialLoadComplete) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Acceso Denegado</AlertTitle>
          <AlertDescription>
            No tiene permisos de administrador para ver esta página.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Lista de Clientes</h1>
          <p className="text-muted-foreground">Gestione sus clientes registrados y sus pagos.</p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Nuevo Cliente
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes Registrados</CardTitle>
          <CardDescription>
            Busque, filtre y administre los clientes, su información de pago y detalles de financiación.
          </CardDescription>
          <div className="mt-4 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
            <Input 
              placeholder="Buscar por nombre, apellido o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm md:flex-grow"
            />
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={paymentStatusFilter} onValueChange={(value) => setPaymentStatusFilter(value as PaymentStatusFilter)}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Estado de Pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Estados</SelectItem>
                  <SelectItem value="al_dia">Al día</SelectItem>
                  <SelectItem value="vence_pronto">Vence Pronto (≤7 días)</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={financingPlanFilter} onValueChange={(value) => setFinancingPlanFilter(value)}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Plan de Financiación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Planes</SelectItem>
                  {Object.entries(financingOptions).map(([key, option]) => (
                    <SelectItem key={key} value={key}>
                      {option.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="0">Sin Financiación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 && !clientsLoading ? (
            <div className="text-center py-10">
              <UsersIconLucide className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">
                {searchTerm || paymentStatusFilter !== "todos" || financingPlanFilter !== "todos"
                  ? 'No se encontraron clientes con los criterios seleccionados.'
                  : 'No se encontraron clientes'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || paymentStatusFilter !== "todos" || financingPlanFilter !== "todos"
                  ? 'Intente con otra búsqueda o ajuste los filtros.'
                  : 'Comience agregando un nuevo cliente.'}
                {!(searchTerm || paymentStatusFilter !== "todos" || financingPlanFilter !== "todos") && (
                  <Button variant="link" asChild className="p-0 h-auto">
                    <Link href="/clients/new">
                      agregue uno nuevo
                    </Link>
                  </Button>
                )}
                .
              </p>
              {!(searchTerm || paymentStatusFilter !== "todos" || financingPlanFilter !== "todos") && (
                <div className="mt-6">
                  <Button asChild>
                    <Link href="/clients/new">
                      <PlusCircle className="mr-2 h-4 w-4" /> Agregar Nuevo Cliente
                    </Link>
                  </Button>
                </div>
              )}
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
                {filteredClients.map((client: Client) => {
                  const daysUntilDueClient = getDaysUntilDue(client.nextPaymentDate);
                  const canSendWhatsAppReminder = client.paymentAmount > 0 && client.status !== 'completed' && daysUntilDueClient >= -5 && daysUntilDueClient <= 5;
                  const canSendEmailReminder = client.paymentAmount > 0 && client.status !== 'completed';

                  const financingPlanLabel = client.financingPlan !== undefined && financingOptions[client.financingPlan] 
                                            ? financingOptions[client.financingPlan].label 
                                            : (client.contractValue && client.contractValue > 0 && client.paymentAmount === 0 ? <span className="text-muted-foreground">Pago único</span> : <span className="text-muted-foreground">N/A</span>);

                  return (
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
                        {financingPlanLabel}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col gap-1 text-xs">
                          {client.acceptanceLetterUrl && (
                            <a href={client.acceptanceLetterUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                              <LinkIconLucide size={12} /> Carta Acept.
                            </a>
                          )}
                          {client.contractFileUrl && (
                            <a href={client.contractFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                              <LinkIconLucide size={12} /> Contrato
                            </a>
                          )}
                          {(!client.acceptanceLetterUrl && !client.contractFileUrl) && <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{client.paymentAmount > 0 ? formatDate(client.nextPaymentDate) : '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        {getPaymentStatusBadge(client)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 sm:gap-2 justify-end">
                          {client.paymentAmount > 0 && client.status !== 'completed' && (
                            <RegisterPaymentButton client={client} />
                          )}
                          {canSendEmailReminder && (
                            <SendReminderButton client={client} daysUntilDue={daysUntilDueClient} />
                          )}
                          {canSendWhatsAppReminder && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button asChild variant="outline" size="icon">
                                    <a
                                      href={generateWhatsAppLink(client)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </a>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Enviar recordatorio por WhatsApp</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {/* ✅ NUEVO: Botón de editar que NO recarga la página */}
                          <EditClientButton
                            client={client} 
                            onClientUpdate={handleClientUpdate}
                          />
                          {/* ✅ ACTUALIZADO: Dialog de eliminar que NO recarga la página */}
                          <DeleteClientDialog 
                            clientId={client.id} 
                            clientName={`${client.firstName} ${client.lastName}`}
                            onClientDelete={handleClientDelete}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredClients.length > 0 && (
          <CardFooter className="text-xs text-muted-foreground">
            Mostrando <strong>{filteredClients.length}</strong> de <strong>{clients.length}</strong> cliente(s).
          </CardFooter>
        )}
      </Card>
    </AppLayout>
  );
}
