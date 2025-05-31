import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    console.log('🔍 Iniciando proceso de subida de archivo...');
    
    // Validar que el archivo no sea muy grande (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('El archivo es muy grande. Máximo 5MB permitido.');
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no permitido. Solo JPG, PNG o PDF.');
    }

    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storageRef = ref(storage, `${path}/${fileName}`);
    
    console.log(`📤 Subiendo archivo a: ${path}/${fileName}`);
    console.log(`📁 Tamaño del archivo: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`✅ Archivo subido exitosamente: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    if (error instanceof Error) {
      throw new Error(`Error al subir el archivo: ${error.message}`);
    }
    throw new Error('Error desconocido al subir el archivo');
  }
}