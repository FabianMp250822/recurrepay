
'use client'; 

import Link from 'next/link';
import { PlusCircle, Edit3, Users as UsersIconLucide, FileText, DollarSign, Link as LinkIconLucide, Loader2, Terminal, CreditCard as CreditCardIcon, CheckCircle, MessageSquare, Filter } from 'lucide-react';
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
import { getClients, getFinancingOptionsMap, getGeneralSettings } from '@/lib/store';
import { formatDate, formatCurrency, getDaysUntilDue, cleanPhoneNumberForWhatsApp } from '@/lib/utils';
import DeleteClientDialog from '@/components/clients/delete-client-dialog';
import RegisterPaymentButton from '@/components/clients/RegisterPaymentButton'; 
import type { Client, AppGeneralSettings } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FinancingOptionsMap = { [key: number]: { rate: number; label: string } };

type PaymentStatusFilter = "todos" | "al_dia" | "vence_pronto" | "vencido" | "completado";

export default function ClientsListPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, isAdmin, initialLoadComplete } = useAuth();
  const [financingOptions, setFinancingOptions] = useState<FinancingOptionsMap>({});
  const [appName, setAppName] = useState('RecurPay');

  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("todos");
  const [financingPlanFilter, setFinancingPlanFilter] = useState<string>("todos");


  const fetchClientsAndOptions = useCallback(async () => {
    if (!initialLoadComplete || !isAdmin) {
      if (initialLoadComplete && !isAdmin) {
         setError("Acceso denegado. No tiene permisos para ver esta información.");
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedClients, finOptions, generalSettings] = await Promise.all([
        getClients(),
        getFinancingOptionsMap(),
        getGeneralSettings() 
      ]);
      setClients(fetchedClients);
      setFinancingOptions(finOptions);
      if (generalSettings && generalSettings.appName) {
        setAppName(generalSettings.appName);
      }
    } catch (err: any) {
      console.error("Error fetching data on clients list page. AuthContext state: ", { userUid: user?.uid, isAdminContext: isAdmin, initialLoadCompleteContext: initialLoadComplete }, err);
      const detailedError = err.message || 'Error al cargar los datos. Por favor, inténtelo de nuevo.';
      setError(detailedError.includes("permission denied") || detailedError.includes("Permiso denegado") ? "Permiso denegado por Firestore al buscar clientes/opciones. Asegúrese de que las reglas de seguridad de Firebase permitan el acceso de lectura requerido para administradores autenticados y activos, y que su cuenta de administrador esté configurada correctamente con el estado 'activo: true'." : detailedError);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user?.uid, initialLoadComplete]);

  useEffect(() => {
    if (initialLoadComplete) {
      if (isAdmin) {
        fetchClientsAndOptions();
      } else {
        setError("Acceso denegado. No es un administrador autorizado.");
        setIsLoading(false);
        setClients([]);
      }
    }
  }, [initialLoadComplete, isAdmin, fetchClientsAndOptions]);

  const filteredClients = useMemo(() => {
    let CriterioBusquedalients = clients;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      CriterioBusquedalients = CriterioBusquedalients.filter(client => 
        client.firstName.toLowerCase().includes(lowerSearchTerm) ||
        client.lastName.toLowerCase().includes(lowerSearchTerm) ||
        client.email.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Filtrar por estado de pago
    if (paymentStatusFilter !== "todos") {
      CriterioBusquedalients = CriterioBusquedalients.filter(client => {
        const daysUntil = getDaysUntilDue(client.nextPaymentDate);
        const isCompleted = client.status === 'completed' || (client.paymentAmount === 0 && client.status !== 'active');

        if (paymentStatusFilter === "completado") return isCompleted;
        if (isCompleted) return false; // No incluir completados en otros filtros

        if (paymentStatusFilter === "al_dia") return daysUntil > 7;
        if (paymentStatusFilter === "vence_pronto") return daysUntil > 0 && daysUntil <= 7;
        if (paymentStatusFilter === "vencido") return daysUntil < 0;
        return true;
      });
    }

    // Filtrar por plan de financiación
    if (financingPlanFilter !== "todos") {
      const planKey = parseInt(financingPlanFilter, 10);
      CriterioBusquedalients = CriterioBusquedalients.filter(client => client.financingPlan === planKey);
    }

    return CriterioBusquedalients;
  }, [clients, searchTerm, paymentStatusFilter, financingPlanFilter]);


  function getPaymentStatusBadge(client: Client): React.ReactElement {
    if (client.status === 'completed' || (client.paymentAmount === 0 && client.contractValue && client.contractValue > 0 && client.status !== 'active')) {
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completado</Badge>;
    }
    if (client.paymentAmount === 0 && (!client.contractValue || client.contractValue === 0)) {
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completado</Badge>;
    }
    const daysUntil = getDaysUntilDue(client.nextPaymentDate);
    if (daysUntil < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (daysUntil <= 3) { // Ajustar para "Vence Pronto" más amplio
      return <Badge className="bg-yellow-500 text-black hover:bg-yellow-600 dark:bg-yellow-600 dark:text-white dark:hover:bg-yellow-700">Vence Pronto</Badge>;
    }
    if (daysUntil <= 7) { // Este es "Próximo" pero el filtro "Vence Pronto" lo cubre
      return <Badge variant="secondary">Próximo</Badge>;
    }
    return <Badge variant="outline">Al día</Badge>; // Cambiado de "Programado" a "Al día"
  }

  const generateWhatsAppLink = (client: Client) => {
    const cleanedPhoneNumber = cleanPhoneNumberForWhatsApp(client.phoneNumber);
    if (!cleanedPhoneNumber) return "#"; 

    const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);
    const clientFullName = `${client.firstName} ${client.lastName}`;
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
                  <SelectTrigger className="w-full md:w-[180px]">
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
                  </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 && !isLoading ? (
            <div className="text-center py-10">
              <UsersIconLucide className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">
                {searchTerm || paymentStatusFilter !== "todos" || financingPlanFilter !== "todos"
                  ? 'No se encontraron clientes con los criterios seleccionados.' 
                  : 'No se encontraron clientes'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || paymentStatusFilter !== "todos" || financingPlanFilter !== "todos"
                  ? 'Intente con otra búsqueda o ajuste los filtros. ' 
                  : 'Comience agregando un nuevo cliente. '}
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
                      {client.paymentAmount > 0 && client.status !== 'completed' && <RegisterPaymentButton client={client} />}
                       {canSendWhatsAppReminder && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" asChild className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700">
                                <a href={generateWhatsAppLink(client)} target="_blank" rel="noopener noreferrer" aria-label={`Enviar recordatorio por WhatsApp a ${client.firstName} ${client.lastName}`}>
                                  <MessageSquare className="h-4 w-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Enviar Recordatorio por WhatsApp</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
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
                      <DeleteClientDialog clientId={client.id} clientName={`${client.firstName} ${client.lastName}`} />
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

