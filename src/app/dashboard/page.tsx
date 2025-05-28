
import Link from 'next/link';
import { PlusCircle, Edit3, UsersIcon as Users, FileText, DollarSign, LinkIcon } from 'lucide-react';
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


export default async function DashboardPage() {
  const clients = await getClients();

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
          {clients.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
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

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

