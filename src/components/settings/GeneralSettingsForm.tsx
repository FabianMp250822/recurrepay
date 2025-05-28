
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
import React, { useState, useCallback, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { generalSettingsSchema } from '@/lib/schema';
import type { AppGeneralSettings, AppGeneralSettingsFormData } from '@/types';
import { updateGeneralSettingsAction } from '@/app/actions/settingsActions';
import { storage, auth } from '@/lib/firebase'; // Ensure auth is imported if needed for rules, though typically storage rules handle this
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle, LinkIcon, Trash2 } from 'lucide-react';

type GeneralSettingsFormProps = {
  currentSettings: AppGeneralSettings;
};

type FileUploadState = {
  file: File | null;
  progress: number;
  url: string | null; // Holds the URL after successful upload OR the existing URL
  name: string | null;
  error: string | null;
  isUploading: boolean;
};

const initialFileUploadState: FileUploadState = {
  file: null,
  progress: 0,
  url: null,
  name: null,
  error: null,
  isUploading: false,
};

export function GeneralSettingsForm({ currentSettings }: GeneralSettingsFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [logoUploadState, setLogoUploadState] = useState<FileUploadState>({
    ...initialFileUploadState,
    url: currentSettings.appLogoUrl || null, // Initialize with current logo URL
  });

  const form = useForm<z.infer<typeof generalSettingsSchema>>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      appName: currentSettings.appName || '',
      appLogoUrl: currentSettings.appLogoUrl || '',
      notificationsEnabled: currentSettings.notificationsEnabled || false,
    },
  });

  // Update form if currentSettings change (e.g., after save and re-fetch)
  useEffect(() => {
    form.reset({
      appName: currentSettings.appName || '',
      appLogoUrl: currentSettings.appLogoUrl || '',
      notificationsEnabled: currentSettings.notificationsEnabled || false,
    });
    setLogoUploadState(prev => ({ ...prev, url: currentSettings.appLogoUrl || null, name: null, file: null, progress: 0, error: null, isUploading: false }));
  }, [currentSettings, form]);


  const handleLogoUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Optional: Validate user is admin before upload attempt (client-side check)
    // This is secondary to Storage security rules
    if (!auth.currentUser) {
        toast({ title: "Error", description: "Debe estar autenticado para subir un logo.", variant: "destructive" });
        return;
    }
    
    setLogoUploadState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null }));
    const uniqueFileName = `logo_${Date.now()}_${file.name}`;
    // Using a more generic path, or could include user UID if logos were user-specific
    const storagePath = `app_branding/logo/${uniqueFileName}`; 
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setLogoUploadState(prev => ({ ...prev, progress }));
      },
      (error) => {
        console.error("Error al subir logo:", error);
        setLogoUploadState(prev => ({ ...prev, isUploading: false, error: error.message, progress: 0 }));
        toast({ title: "Error al subir logo", description: error.message, variant: "destructive" });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setLogoUploadState(prev => ({ ...prev, isUploading: false, url: downloadURL, name: file.name, progress: 100 }));
        form.setValue('appLogoUrl', downloadURL, { shouldValidate: true });
        toast({ title: "Logo subido", description: `${file.name} subido con éxito.` });
      }
    );
  }, [form, toast]);

  const handleDeleteLogo = async () => {
    if (!logoUploadState.url) return;

    // Optional: Confirm before deleting
    const confirmed = window.confirm("¿Está seguro de que desea eliminar el logo actual? Esta acción no se puede deshacer si guarda los cambios.");
    if (!confirmed) return;
    
    // If the URL is a Firebase Storage URL, try to delete it from Storage
    if (logoUploadState.url.includes("firebasestorage.googleapis.com")) {
        try {
            const logoRef = ref(storage, logoUploadState.url);
            await deleteObject(logoRef);
            toast({ title: "Logo eliminado de Storage" });
        } catch (error: any) {
            // If deletion fails (e.g. rules, file not found), still clear it from the form.
            // The server will save an empty URL.
            console.warn("No se pudo eliminar el logo de Firebase Storage:", error.message);
             toast({ title: "Advertencia", description: "No se pudo eliminar el archivo de logo anterior del almacenamiento, pero se quitará de la configuración.", variant: "default" });
        }
    }
    setLogoUploadState(initialFileUploadState); // Reset state
    form.setValue('appLogoUrl', '', { shouldValidate: true }); // Clear URL in form
  };


  async function onSubmit(values: z.infer<typeof generalSettingsSchema>) {
    setIsSubmitting(true);

    const formDataToSubmit: AppGeneralSettingsFormData = {
      appName: values.appName,
      appLogoUrl: logoUploadState.url || '', // Use the URL from upload state or existing
      notificationsEnabled: values.notificationsEnabled,
    };

    try {
      const result = await updateGeneralSettingsAction(formDataToSubmit);
      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: result.message || 'La configuración general ha sido actualizada.',
        });
        // Form reset is handled by useEffect on currentSettings change
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
             if (messages && messages.length > 0) {
                form.setError(field as keyof z.infer<typeof generalSettingsSchema>, { type: 'manual', message: messages[0] });
             }
          });
        }
        toast({
          title: 'Error al Guardar',
          description: result.generalError || 'No se pudo guardar la configuración general.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error Inesperado',
        description: (error instanceof Error ? error.message : String(error)),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidad y Preferencias de la Aplicación</CardTitle>
        <CardDescription>
          Personalice el nombre, logo y otras configuraciones generales de la plataforma RecurPay.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="appName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Aplicación</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: RecurPay Pro" {...field} />
                  </FormControl>
                  <FormDescription>
                    Este nombre se mostrará en la aplicación.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Logo de la Aplicación</FormLabel>
              {logoUploadState.url && !logoUploadState.isUploading && (
                <div className="my-2 p-2 border rounded-md ">
                  <p className="text-sm text-muted-foreground mb-2">Logo actual:</p>
                  <Image 
                    src={logoUploadState.url} 
                    alt="Logo actual de la aplicación" 
                    width={150} 
                    height={50} 
                    className="rounded object-contain border bg-slate-100 dark:bg-slate-800"
                    unoptimized // If storage URLs are not in next.config.js images.remotePatterns
                  />
                   <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDeleteLogo} 
                    className="mt-2 text-destructive hover:text-destructive"
                    disabled={isSubmitting || logoUploadState.isUploading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar Logo
                  </Button>
                </div>
              )}
              {!logoUploadState.url && !logoUploadState.isUploading && (
                 <div className="my-2 p-2 border rounded-md border-dashed">
                  <Image 
                    src="https://placehold.co/150x50.png?text=Sin+Logo" // Placeholder
                    alt="Sin logo configurado" 
                    width={150} 
                    height={50} 
                    className="rounded object-contain"
                    data-ai-hint="logo placeholder"
                  />
                </div>
              )}
              <FormControl>
                <Input
                  id="appLogoFile"
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                  disabled={logoUploadState.isUploading || isSubmitting}
                />
              </FormControl>
              {logoUploadState.isUploading && (
                <div className="mt-2">
                  <Progress value={logoUploadState.progress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground mt-1">Subiendo: {logoUploadState.file?.name} ({logoUploadState.progress.toFixed(0)}%)</p>
                </div>
              )}
              {logoUploadState.url && !logoUploadState.isUploading && logoUploadState.file && ( // Only show success if a NEW file was just uploaded
                <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={16} /> ¡{logoUploadState.name} subido con éxito! La URL se guardará al hacer clic en "Guardar Cambios".
                </div>
              )}
              {logoUploadState.error && !logoUploadState.isUploading && (
                <div className="mt-2 text-sm text-destructive flex items-center gap-1">
                  <XCircle size={16} /> Error: {logoUploadState.error}
                </div>
              )}
              <FormDescription>
                Sube el logo de tu empresa (recomendado: PNG, JPG, SVG, WEBP, max 2MB).
              </FormDescription>
              <FormMessage />
            </FormItem>
            
            <FormField
              control={form.control}
              name="notificationsEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Activar Notificaciones</FormLabel>
                    <FormDescription>
                      Habilitar alertas y notificaciones administrativas dentro de la plataforma.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || logoUploadState.isUploading}>
                {(isSubmitting || logoUploadState.isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios Generales
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
