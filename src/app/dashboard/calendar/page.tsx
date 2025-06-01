'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Plus, Users, Clock, MapPin, Edit, Trash2, Phone, Video, MessageSquare, Search, ExternalLink } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import AppLayout from '@/components/layout/app-layout';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClients, type Client } from '@/lib/store';
import { cleanPhoneNumberForWhatsApp, formatDate } from '@/lib/utils';

// ✅ NUEVA interfaz mejorada para eventos
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  time: string;
  type: 'meeting' | 'call' | 'visit' | 'other';
  clientId?: string; // ✅ NUEVO: ID del cliente seleccionado
  clientName?: string; // ✅ NUEVO: Nombre del cliente
  clientPhone?: string; // ✅ NUEVO: Teléfono del cliente
  location?: string;
  meetingLink?: string; // ✅ NUEVO: Enlace de Zoom/Meet
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
}

// ✅ ACTUALIZAR: esquema de validación
const eventSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  date: z.date({
    required_error: 'La fecha es requerida',
  }),
  time: z.string().min(1, 'La hora es requerida'),
  type: z.enum(['meeting', 'call', 'visit', 'other']),
  clientId: z.string().optional(), // Acepta cualquier string, incluido 'none'
  location: z.string().optional(),
  meetingLink: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
  duration: z.number().min(15, 'La duración mínima es 15 minutos'),
});

type EventFormData = z.infer<typeof eventSchema>;

export default function CalendarPage() {
  const { isAdmin, initialLoadComplete } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  
  // ✅ NUEVO: Estados para clientes
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      date: new Date(),
      time: '09:00',
      type: 'meeting',
      clientId: 'none', // ✅ CAMBIO: usar 'none' como valor por defecto
      location: '',
      meetingLink: '',
      duration: 60,
    },
  });

  // ✅ NUEVO: Cargar clientes al abrir el modal
  const loadClients = useCallback(async () => {
    if (loadingClients) return;
    
    setLoadingClients(true);
    try {
      const clientsList = await getClients();
      setClients(clientsList);
      setFilteredClients(clientsList);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  }, [loadingClients]);

  // ✅ NUEVO: Filtrar clientes por búsqueda
  useEffect(() => {
    if (!clientSearch.trim()) {
      setFilteredClients(clients);
    } else {
      const searchTerm = clientSearch.toLowerCase();
      const filtered = clients.filter(client => 
        client.firstName.toLowerCase().includes(searchTerm) ||
        client.lastName.toLowerCase().includes(searchTerm) ||
        client.email.toLowerCase().includes(searchTerm)
      );
      setFilteredClients(filtered);
    }
  }, [clientSearch, clients]);

  // ✅ NUEVO: Abrir modal y cargar clientes
  const handleOpenDialog = () => {
    setEditingEvent(null);
    form.reset({
      date: selectedDate,
      time: '09:00',
      type: 'meeting',
      duration: 60,
      clientId: 'none', // ✅ CAMBIO: usar 'none' en lugar de ''
      meetingLink: '',
    });
    setClientSearch('');
    loadClients();
    setIsDialogOpen(true);
  };

  useEffect(() => {
    loadMockEvents();
  }, []);

  useEffect(() => {
    filterEventsByDate();
  }, [selectedDate, events, viewMode]);

  const loadMockEvents = () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Reunión con Cliente ABC',
        description: 'Revisión de propuesta comercial',
        date: new Date(),
        time: '10:00',
        type: 'meeting',
        clientName: 'Juan Pérez',
        clientPhone: '+573001234567',
        location: 'Oficina principal',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        duration: 60,
        status: 'scheduled',
        createdAt: new Date(),
      },
      {
        id: '2',
        title: 'Llamada de seguimiento',
        description: 'Seguimiento de pagos pendientes',
        date: new Date(Date.now() + 86400000),
        time: '14:30',
        type: 'call',
        clientName: 'María García',
        clientPhone: '+573009876543',
        duration: 30,
        status: 'scheduled',
        createdAt: new Date(),
      },
    ];
    setEvents(mockEvents);
  };

  const filterEventsByDate = () => {
    const filtered = events.filter(event => {
      if (viewMode === 'day') {
        return format(event.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      } else if (viewMode === 'week') {
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return event.date >= startOfWeek && event.date <= endOfWeek;
      } else {
        return event.date.getMonth() === selectedDate.getMonth() &&
               event.date.getFullYear() === selectedDate.getFullYear();
      }
    });
    setFilteredEvents(filtered.sort((a, b) => 
      new Date(a.date.toDateString() + ' ' + a.time).getTime() - 
      new Date(b.date.toDateString() + ' ' + b.time).getTime()
    ));
  };

  const onSubmit = (data: EventFormData) => {
    // ✅ Buscar datos del cliente seleccionado (verificar que no sea 'none')
    const selectedClient = data.clientId && data.clientId !== 'none' 
      ? clients.find(c => c.id === data.clientId) 
      : null;
    
    const newEvent: CalendarEvent = {
      id: editingEvent ? editingEvent.id : Date.now().toString(),
      ...data,
      clientId: selectedClient?.id,
      clientName: selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : undefined,
      clientPhone: selectedClient?.phoneNumber,
      status: 'scheduled',
      createdAt: editingEvent ? editingEvent.createdAt : new Date(),
    };

    if (editingEvent) {
      setEvents(events.map(e => e.id === editingEvent.id ? newEvent : e));
    } else {
      setEvents([...events, newEvent]);
    }

    setIsDialogOpen(false);
    setEditingEvent(null);
    form.reset();
  };

  const deleteEvent = (eventId: string) => {
    setEvents(events.filter(e => e.id !== eventId));
  };

  const editEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description || '',
      date: event.date,
      time: event.time,
      type: event.type,
      clientId: event.clientId || 'none', // ✅ CAMBIO: usar 'none' en lugar de ''
      location: event.location || '',
      meetingLink: event.meetingLink || '',
      duration: event.duration,
    });
    loadClients();
    setIsDialogOpen(true);
  };

  // ✅ NUEVO: Generar mensaje de WhatsApp para reunión
  const generateWhatsAppEventLink = (event: CalendarEvent) => {
    if (!event.clientPhone) return "#";
    
    const cleanedPhoneNumber = cleanPhoneNumberForWhatsApp(event.clientPhone);
    if (!cleanedPhoneNumber) return "#";

    const eventDate = formatDate(event.date);
    const eventTime = event.time;
    
    let message = `Hola ${event.clientName || 'estimado cliente'}, `;
    message += `te escribo para recordarte que tenemos una ${event.type === 'meeting' ? 'reunión' : event.type === 'call' ? 'llamada' : 'cita'} programada para el ${eventDate} a las ${eventTime}.`;
    
    if (event.description) {
      message += `\n\nTema: ${event.description}`;
    }
    
    if (event.meetingLink) {
      message += `\n\n🔗 Enlace de la reunión: ${event.meetingLink}`;
    }
    
    if (event.location && event.type !== 'call') {
      message += `\n\n📍 Ubicación: ${event.location}`;
    }
    
    message += `\n\nDuración estimada: ${event.duration} minutos.`;
    message += `\n\n¡Gracias!`;

    return `https://wa.me/${cleanedPhoneNumber}?text=${encodeURIComponent(message)}`;
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting': return <Users className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'visit': return <MapPin className="h-4 w-4" />;
      case 'other': return <CalendarIcon className="h-4 w-4" />;
      default: return <CalendarIcon className="h-4 w-4" />;
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'meeting': return 'Reunión';
      case 'call': return 'Llamada';
      case 'visit': return 'Visita';
      case 'other': return 'Otro';
      default: return 'Evento';
    }
  };

  const hasEventsOnDate = (date: Date) => {
    return events.some(event => 
      format(event.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
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

  if (!isAdmin) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
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
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-100 px-6 py-8 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <CalendarIcon className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-gray-900">Calendario de Eventos</h1>
            </div>
            <p className="text-gray-600">Gestione sus reuniones, llamadas y eventos programados con clientes.</p>
          </div>
          
          {/* ✅ NUEVO: Modal optimizado con posición centrada */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            
            {/* ✅ MODAL CENTRADO AL 40% CON SCROLL */}
            <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] top-[40%] translate-y-[-40%] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>
                  {editingEvent ? 'Editar Evento' : 'Crear Nuevo Evento'}
                </DialogTitle>
                <DialogDescription>
                  Complete la información del evento y seleccione un cliente si es necesario.
                </DialogDescription>
              </DialogHeader>
              
              {/* ✅ CONTENIDO CON SCROLL */}
              <div className="flex-1 overflow-y-auto pr-2">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Información básica */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título del Evento</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Reunión con cliente..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción (Opcional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Detalles adicionales del evento..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* ✅ NUEVA SECCIÓN: Selección de Cliente */}
                    <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                      <h3 className="font-semibold text-blue-900">Cliente (Opcional)</h3>
                      
                      {/* Búsqueda de clientes */}
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar cliente por nombre, apellido o email..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        
                        {loadingClients && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando clientes...
                          </div>
                        )}
                      </div>

                      {/* Selección de cliente */}
                      <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cliente Seleccionado</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar cliente..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[200px]">
                                {/* ✅ CAMBIO: Usar "none" en lugar de cadena vacía */}
                                <SelectItem value="none">Sin cliente específico</SelectItem>
                                {filteredClients.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {client.firstName} {client.lastName}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {client.email}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Fecha y hora */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha</FormLabel>
                            <FormControl>
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                className="rounded-md border"
                                locale={es}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="time"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hora</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="duration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duración (minutos)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="15" 
                                  step="15"
                                  {...field}
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Evento</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar tipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="meeting">📹 Reunión</SelectItem>
                                  <SelectItem value="call">📞 Llamada</SelectItem>
                                  <SelectItem value="visit">🏢 Visita</SelectItem>
                                  <SelectItem value="other">📋 Otro</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* ✅ NUEVA SECCIÓN: Enlace de reunión y ubicación */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="meetingLink"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Video className="h-4 w-4" />
                              Enlace de Reunión (Zoom/Meet)
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="https://meet.google.com/xxx-xxxx-xxx" 
                                {...field} 
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Opcional: Enlace de Zoom, Google Meet, Teams, etc.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Ubicación (Opcional)
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Lugar del evento..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingEvent ? 'Actualizar' : 'Crear'} Evento
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendario */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Calendario</CardTitle>
              <div className="flex gap-2">
                <Select value={viewMode} onValueChange={(value: 'month' | 'week' | 'day') => setViewMode(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Mes</SelectItem>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="day">Día</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full"
              locale={es}
              modifiers={{
                hasEvents: (date) => hasEventsOnDate(date)
              }}
              modifiersStyles={{
                hasEvents: { 
                  backgroundColor: 'rgb(59 130 246 / 0.1)',
                  color: 'rgb(59 130 246)',
                  fontWeight: 'bold'
                }
              }}
            />
          </CardContent>
        </Card>

        {/* ✅ LISTA DE EVENTOS MEJORADA */}
        <Card>
          <CardHeader>
            <CardTitle>
              Eventos - {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
            </CardTitle>
            <CardDescription>
              {filteredEvents.length} evento(s) programado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay eventos programados</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getEventTypeIcon(event.type)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{event.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {event.time} • {event.duration}min • {getEventTypeLabel(event.type)}
                          </p>
                          
                          {/* ✅ NUEVA: Información del cliente */}
                          {event.clientName && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                              <p className="font-medium text-blue-900">
                                👤 {event.clientName}
                              </p>
                              {event.clientPhone && (
                                <p className="text-blue-700">
                                  📱 {event.clientPhone}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* ✅ NUEVA: Enlaces y ubicación */}
                          <div className="mt-2 space-y-1">
                            {event.meetingLink && (
                              <div className="flex items-center gap-2">
                                <Video className="h-4 w-4 text-green-600" />
                                <a 
                                  href={event.meetingLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-green-600 hover:underline flex items-center gap-1"
                                >
                                  Unirse a la reunión
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                            
                            {event.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-600">{event.location}</span>
                              </div>
                            )}
                          </div>
                          
                          {event.description && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* ✅ NUEVAS: Acciones mejoradas */}
                      <div className="flex flex-col gap-1 ml-2">
                        {/* WhatsApp para cliente */}
                        {event.clientPhone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-green-600 hover:text-green-700"
                          >
                            <a
                              href={generateWhatsAppEventLink(event)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar por WhatsApp"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        
                        {/* Editar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editEvent(event)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        {/* Eliminar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEvent(event.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}