import Link from 'next/link';
import { PlusCircle, Edit3, Trash2, Mail } from 'lucide-react';
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
import { Client } from '@/types';

export default async function DashboardPage() {
  const clients = await getClients();

  function getPaymentStatusBadge(nextPaymentDate: string): React.ReactElement {
    const daysUntil = getDaysUntilDue(nextPaymentDate);
    if (daysUntil < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (daysUntil <= 3) {
      return <Badge variant="default" className="bg-yellow-500 text-black hover:bg-yellow-600">Due Soon</Badge>;
    }
    if (daysUntil <= 7) {
      return <Badge variant="secondary">Upcoming</Badge>;
    }
    return <Badge variant="outline">Scheduled</Badge>;
  }


  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Client Management</h1>
          <p className="text-muted-foreground">View, manage, and add new clients.</p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Client
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Client List</CardTitle>
          <CardDescription>
            A list of all registered clients and their payment information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-10">
              <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No clients found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new client.</p>
              <div className="mt-6">
                <Button asChild>
                  <Link href="/clients/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Client
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Next Payment</TableHead>
                <TableHead className="hidden sm:table-cell text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client: Client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="font-medium">{client.firstName} {client.lastName}</div>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell className="hidden md:table-cell">{client.phoneNumber}</TableCell>
                  <TableCell className="text-right">{formatCurrency(client.paymentAmount)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(client.nextPaymentDate)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-center">
                    {getPaymentStatusBadge(client.nextPaymentDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="icon" asChild TooltipContent="Edit Client">
                        <Link href={`/clients/${client.id}/edit`}>
                          <Edit3 className="h-4 w-4" />
                           <span className="sr-only">Edit Client</span>
                        </Link>
                      </Button>
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
            Showing <strong>{clients.length}</strong> client(s).
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
