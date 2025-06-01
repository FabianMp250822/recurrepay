'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { Client } from '@/types';
import ClientForm from './client-form';

interface EditClientButtonProps {
  client: Client;
  onClientUpdate: (clientId: string, updates: Partial<Client>) => void;
}

export default function EditClientButton({ client, onClientUpdate }: EditClientButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClientUpdated = (updatedClient: Client) => {
    console.log('✅ Cliente actualizado en modal:', updatedClient); // Debug
    
    // Actualizar el cliente en la lista padre
    onClientUpdate(client.id, updatedClient);
    
    // Cerrar el modal
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Edit className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Editar Cliente</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Modifique la información del cliente {client.firstName} {client.lastName}
          </DialogDescription>
        </DialogHeader>
        
        <ClientForm
          client={client} 
          isEditMode={true}
          isModal={true}
          onClientUpdated={handleClientUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}