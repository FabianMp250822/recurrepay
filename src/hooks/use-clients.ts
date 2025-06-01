'use client';

import { useState, useCallback } from 'react';
import { getClients } from '@/lib/store';
import type { Client } from '@/types';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedClients = await getClients();
      setClients(fetchedClients);
    } catch (err: any) {
      console.error('Error loading clients:', err);
      setError(err.message || 'Error al cargar los clientes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Actualización optimista para agregar cliente
  const addClientOptimistic = useCallback((client: Client) => {
    setClients(prev => [client, ...prev]);
  }, []);

  // Actualización optimista para actualizar cliente
  const updateClientOptimistic = useCallback((clientId: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(client => 
      client.id === clientId ? { ...client, ...updates } : client
    ));
  }, []);

  // Actualización optimista para eliminar cliente
  const deleteClientOptimistic = useCallback((clientId: string) => {
    setClients(prev => prev.filter(client => client.id !== clientId));
  }, []);

  // Función para revertir cambios en caso de error
  const revertClients = useCallback((originalClients: Client[]) => {
    setClients(originalClients);
  }, []);

  return {
    clients,
    isLoading,
    error,
    loadClients,
    addClientOptimistic,
    updateClientOptimistic,
    deleteClientOptimistic,
    revertClients,
    setClients
  };
}