
'use server';

import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function testMercadoPagoPreferenceCreation() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("Error: MERCADOPAGO_ACCESS_TOKEN no está configurado en las variables de entorno.");
    return { success: false, error: "Access Token no configurado." };
  }

  try {
    const tokenDisplay = accessToken.length > 10 ? `${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 4)}` : "Token muy corto para mostrar extracto";
    console.log("Iniciando prueba de Mercado Pago con Access Token:", tokenDisplay);

    const client = new MercadoPagoConfig({ accessToken: accessToken, options: { timeout: 5000 } });
    const preference = new Preference(client);

    console.log("Creando preferencia de prueba...");
    const testPayerEmail = "test_user_1921133160@testuser.com";

    const result = await preference.create({
      body: {
        items: [
          {
            id: 'test_item_123',
            title: 'Producto de Prueba RecurPay',
            quantity: 1,
            unit_price: 100.50,
            currency_id: 'COP',
            description: 'Descripción del producto de prueba',
            category_id: 'services',
          },
        ],
        payer: {
          email: testPayerEmail,
        },
        back_urls: {
          success: 'http://localhost:3000/success', // Cambia a tu URL de éxito real
          failure: 'http://localhost:3000/failure', // Cambia a tu URL de fallo real
          pending: 'http://localhost:3000/pending', // Cambia a tu URL pendiente real
        },
        auto_return: 'approved',
        external_reference: 'RecurPayTest_12345',
        notification_url: 'https://example.com/api/mp_webhook', // Cambia a tu URL de notificación real
      },
    });

    console.log("Respuesta de Creación de Preferencia de Mercado Pago:", JSON.stringify(result, null, 2));
    if (result.id) {
      console.log("¡Preferencia de prueba creada exitosamente! ID de Preferencia:", result.id);
      console.log("Puedes usar el init_point para probar el checkout:", result.init_point);
      return { success: true, preferenceId: result.id, init_point: result.init_point };
    } else {
      console.error("Error al crear la preferencia de prueba, no se recibió ID:", result);
      return { success: false, error: "Error al crear la preferencia, no se recibió ID.", details: result };
    }
  } catch (error: any) {
    console.error("Error durante la prueba de creación de preferencia de Mercado Pago (Objeto Completo):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    let errorMessage = "Error desconocido al conectar con Mercado Pago.";
    let errorDetailsJson = null;

    if (error.cause && typeof error.cause === 'object') {
        // MercadoPago SDK v2 often wraps the actual error in 'cause'
        errorDetailsJson = error.cause;
    } else if (error.data && typeof error.data === 'object') {
        // Older SDK versions or direct API errors might have details in 'data'
        errorDetailsJson = error.data;
    } else {
        errorDetailsJson = error; // Fallback to the error object itself
    }
    
    // Log a stringified version for better inspection in server logs
    const errorDetailsString = JSON.stringify(errorDetailsJson, null, 2);
    console.error("Detalles del error de Mercado Pago (Extraído):", errorDetailsString);

    if (errorDetailsJson && errorDetailsJson.status && errorDetailsJson.message) {
        errorMessage = `Error de Mercado Pago (${errorDetailsJson.status}): ${errorDetailsJson.message}`;
        if (errorDetailsJson.cause && Array.isArray(errorDetailsJson.cause) && errorDetailsJson.cause.length > 0) {
            const firstCause = errorDetailsJson.cause[0];
            errorMessage += ` Causa: ${firstCause.code} - ${firstCause.description}`;
            if (firstCause.code === 2002 || firstCause.description?.toLowerCase().includes("invalid token")) {
                 errorMessage = `Error de Mercado Pago (${errorDetailsJson.status}): Token inválido. Verifica tu MERCADOPAGO_ACCESS_TOKEN. Detalle: ${firstCause.description}`;
            }
             if (firstCause.code === 2001 || firstCause.description?.toLowerCase().includes("invalid parameters")) {
                 errorMessage = `Error de Mercado Pago (${errorDetailsJson.status}): Parámetros inválidos en la preferencia. Detalle: ${firstCause.description}`;
            }
        }
    } else if (error.message) {
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage, details: errorDetailsJson };
  }
}
