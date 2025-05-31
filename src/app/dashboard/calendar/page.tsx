'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Clock, Users, Video, MapPin, Trash2, Edit } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import AppLayout from '@/components/layout/app-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tipos para eventos
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  time: string;
  type: 'meeting' | 'call' | 'visit' | 'other';
  clientName?: string;
  location?: string;
  duration: number; // en minutos
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
}

// Schema de validación
const eventSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  date: z.date({
    required_error: 'La fecha es requerida',
  }),
  time: z.string().min(1, 'La hora es requerida'),
  type: z.enum(['meeting', 'call', 'visit', 'other']),
  clientName: z.string().optional(),
  location: z.string().optional(),
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

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      date: new Date(),
      time: '09:00',
      type: 'meeting',
      clientName: '',
      location: '',
      duration: 60,
    },
  });

  useEffect(() => {
    // Cargar eventos iniciales (mock data por ahora)
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
        location: 'Oficina principal',
        duration: 60,
        status: 'scheduled',
        createdAt: new Date(),
      },
      {
        id: '2',
        title: 'Llamada de seguimiento',
        description: 'Seguimiento de pagos pendientes',
        date: new Date(Date.now() + 86400000), // Mañana
        time: '14:30',
        type: 'call',
        clientName: 'María García',
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
    const newEvent: CalendarEvent = {
      id: editingEvent ? editingEvent.id : Date.now().toString(),
      ...data,
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
      clientName: event.clientName || '',
      location: event.location || '',
      duration: event.duration,
    });
    setIsDialogOpen(true);
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting': return <Users className="h-4 w-4" />;
      case 'call': return <Clock className="h-4 w-4" />;
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
            <p className="text-gray-600">Gestione sus reuniones, llamadas y eventos programados.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingEvent(null);
                form.reset({
                  date: selectedDate,
                  time: '09:00',
                  type: 'meeting',
                  duration: 60,
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? 'Editar Evento' : 'Crear Nuevo Evento'}
                </DialogTitle>
                <DialogDescription>
                  Complete la información del evento que desea programar.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                  <div className="grid grid-cols-2 gap-4">
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="meeting">Reunión</SelectItem>
                                <SelectItem value="call">Llamada</SelectItem>
                                <SelectItem value="visit">Visita</SelectItem>
                                <SelectItem value="other">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Nombre del cliente..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ubicación (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Lugar del evento..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingEvent ? 'Actualizar' : 'Crear'} Evento
                    </Button>
                  </div>
                </form>
              </Form>
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

        {/* Lista de eventos */}
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
                      <div className="flex items-start gap-3">
                        {getEventTypeIcon(event.type)}
                        <div className="flex-1">
                          <h4 className="font-semibold">{event.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {event.time} • {event.duration}min • {getEventTypeLabel(event.type)}
                          </p>
                          {event.clientName && (
                            <p className="text-sm text-blue-600">
                              Cliente: {event.clientName}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-sm text-muted-foreground">
                              📍 {event.location}
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-gray-600 mt-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editEvent(event)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
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