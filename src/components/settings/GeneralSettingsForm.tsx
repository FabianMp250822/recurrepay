
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { storage, auth } from '@/lib/firebase';
import { Loader2, UploadCloud, CheckCircle2, XCircle, LinkIcon, Trash2, Palette } from 'lucide-react';
import { Separator } from '../ui/separator';

type GeneralSettingsFormProps = {
  currentSettings: AppGeneralSettings;
};

type FileUploadState = {
  file: File | null;
  progress: number;
  url: string | null; 
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
    url: currentSettings.appLogoUrl || null, 
  });

  const form = useForm<z.infer<typeof generalSettingsSchema>>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      appName: currentSettings.appName || '',
      appLogoUrl: currentSettings.appLogoUrl || '',
      notificationsEnabled: currentSettings.notificationsEnabled || false,
      themePrimary: currentSettings.themePrimary || '',
      themeSecondary: currentSettings.themeSecondary || '',
      themeAccent: currentSettings.themeAccent || '',
      themeBackground: currentSettings.themeBackground || '',
      themeForeground: currentSettings.themeForeground || '',
    },
  });

  useEffect(() => {
    form.reset({
      appName: currentSettings.appName || '',
      appLogoUrl: currentSettings.appLogoUrl || '',
      notificationsEnabled: currentSettings.notificationsEnabled || false,
      themePrimary: currentSettings.themePrimary || '',
      themeSecondary: currentSettings.themeSecondary || '',
      themeAccent: currentSettings.themeAccent || '',
      themeBackground: currentSettings.themeBackground || '',
      themeForeground: currentSettings.themeForeground || '',
    });
    setLogoUploadState(prev => ({ ...prev, url: currentSettings.appLogoUrl || null, name: null, file: null, progress: 0, error: null, isUploading: false }));
  }, [currentSettings, form]);


  const handleLogoUpload = useCallback(async (file: File) => {
    if (!file) return;
    if (!auth.currentUser) {
        toast({ title: "Error", description: "Debe estar autenticado para subir un logo.", variant: "destructive" });
        return;
    }
    
    setLogoUploadState(prev => ({ ...prev, isUploading: true, file, progress: 0, error: null }));
    const uniqueFileName = `logo_${Date.now()}_${file.name}`;
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
    const confirmed = window.confirm("¿Está seguro de que desea eliminar el logo actual? Esta acción no se puede deshacer si guarda los cambios.");
    if (!confirmed) return;
    
    if (logoUploadState.url.includes("firebasestorage.googleapis.com")) {
        try {
            const logoRef = ref(storage, logoUploadState.url);
            await deleteObject(logoRef);
            toast({ title: "Logo eliminado de Storage" });
        } catch (error: any) {
            console.warn("No se pudo eliminar el logo de Firebase Storage:", error.message);
             toast({ title: "Advertencia", description: "No se pudo eliminar el archivo de logo anterior del almacenamiento, pero se quitará de la configuración.", variant: "default" });
        }
    }
    setLogoUploadState(initialFileUploadState); 
    form.setValue('appLogoUrl', '', { shouldValidate: true }); 
  };


  async function onSubmit(values: z.infer<typeof generalSettingsSchema>) {
    setIsSubmitting(true);

    const formDataToSubmit: AppGeneralSettingsFormData = {
      appName: values.appName,
      appLogoUrl: logoUploadState.url || '', 
      notificationsEnabled: values.notificationsEnabled,
      themePrimary: values.themePrimary,
      themeSecondary: values.themeSecondary,
      themeAccent: values.themeAccent,
      themeBackground: values.themeBackground,
      themeForeground: values.themeForeground,
    };

    try {
      const result = await updateGeneralSettingsAction(formDataToSubmit);
      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: result.message || 'La configuración general ha sido actualizada.',
        });
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

  const renderColorInput = (
    name: "themePrimary" | "themeSecondary" | "themeAccent" | "themeBackground" | "themeForeground",
    label: string,
    placeholder: string = "Ej: 210 40% 8%"
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );


  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidad y Preferencias de la Aplicación</CardTitle>
        <CardDescription>
          Personalice el nombre, logo, colores del tema y otras configuraciones generales de la plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* App Name and Logo Section */}
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
                    unoptimized 
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
                    src="https://placehold.co/150x50.png?text=Sin+Logo"
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
              {logoUploadState.url && !logoUploadState.isUploading && logoUploadState.file && ( 
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
                Sube el logo de tu empresa (PNG, JPG, SVG, WEBP, max 2MB).
              </FormDescription>
              <FormMessage />
            </FormItem>
            
            <Separator />

            {/* Theme Color Customization Section */}
            <div className="space-y-2">
                <h3 className="text-lg font-medium flex items-center gap-2"><Palette size={20} /> Personalización de Tema</h3>
                <p className="text-sm text-muted-foreground">
                    Define los colores principales de la aplicación. Usa el formato HSL: Hue (0-360) Saturation% (0-100%) Lightness% (0-100%).
                    Por ejemplo: <code>210 40% 98%</code>. Los cambios se aplicarán globalmente.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderColorInput("themeBackground", "Color de Fondo (Background)", "Ej: 207 88% 94%")}
                {renderColorInput("themeForeground", "Color de Texto Principal (Foreground)", "Ej: 210 40% 25%")}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renderColorInput("themePrimary", "Color Primario", "Ej: 207 88% 68%")}
                {renderColorInput("themeSecondary", "Color Secundario", "Ej: 207 88% 88%")}
                {renderColorInput("themeAccent", "Color de Acento", "Ej: 124 39% 64%")}
            </div>
            <FormDescription>
              Recarga la página después de guardar para ver los cambios de tema completamente aplicados en toda la interfaz.
            </FormDescription>


            <Separator />
            
            {/* Notifications Section */}
            <FormField
              control={form.control}
              name="notificationsEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Activar Notificaciones</FormLabel>
                    <FormDescription>
                      Habilitar alertas y notificaciones administrativas (funcionalidad futura).
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
