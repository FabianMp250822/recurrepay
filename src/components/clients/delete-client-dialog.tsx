
'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteClientAction } from '@/app/actions/clientActions';
import { useRouter } from 'next/navigation';


type DeleteClientDialogProps = {
  clientId: string;
  clientName: string;
};

export default function DeleteClientDialog({ clientId, clientName }: DeleteClientDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteClientAction(clientId);
      if (result.success) {
        toast({
          title: 'Cliente Eliminado',
          description: `El cliente "${clientName}" ha sido eliminado exitosamente.`,
        });
        router.refresh(); 
        setIsOpen(false); 
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al eliminar el cliente. Por favor, inténtelo de nuevo.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado. Por favor, inténtelo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Eliminar Cliente</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Está seguro de que desea eliminar este cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Esto eliminará permanentemente el registro del cliente <strong>{clientName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
