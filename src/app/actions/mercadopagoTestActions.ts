
'use server';

import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function testMercadoPagoPreferenceCreation() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("Error: MERCADOPAGO_ACCESS_TOKEN no está configurado en las variables de entorno.");
    return { success: false, error: "Access Token no configurado." };
  }

  try {
    // Log para ayudar a verificar el Access Token que se está usando (sin mostrarlo completo)
    const tokenDisplay = accessToken.length > 10 ? `${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 4)}` : "Token muy corto para mostrar extracto";
    console.log("Iniciando prueba de Mercado Pago con Access Token:", tokenDisplay);

    const client = new MercadoPagoConfig({ accessToken: accessToken, options: { timeout: 5000 } });
    const preference = new Preference(client);

    console.log("Creando preferencia de prueba...");
    // Usando un correo de pagador de prueba más específico
    const testPayerEmail = "test_user_1921133160@testuser.com"; // Derivado de TESTUSER1921133160

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
          success: 'http://localhost:3000/success', 
          failure: 'http://localhost:3000/failure',
          pending: 'http://localhost:3000/pending',
        },
        auto_return: 'approved',
        external_reference: 'RecurPayTest_12345',
        notification_url: 'https://example.com/api/mp_webhook', 
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
    console.error("Error durante la prueba de creación de preferencia de Mercado Pago:", error);
    const errorMessage = error.cause?.message || error.message || "Error desconocido";
    const errorDetails = error.cause || error;
    console.error("Detalles del error de Mercado Pago:", JSON.stringify(errorDetails, null, 2));
    // Verificar si el error de Mercado Pago tiene un 'status' y 'cause' para un mensaje más específico
    if (errorDetails && errorDetails.status === 401 && errorDetails.cause?.some((c: any) => c.code === 2002 || c.description?.toLowerCase().includes("invalid token"))) {
        return { success: false, error: `Error de Mercado Pago (401): Token inválido. Verifica tu MERCADOPAGO_ACCESS_TOKEN.`, details: errorDetails };
    }
    if (errorDetails && errorDetails.status === 400 && errorDetails.cause?.some((c: any) => c.code === 2001 || c.description?.toLowerCase().includes("invalid parameters"))) {
         return { success: false, error: `Error de Mercado Pago (400): Parámetros inválidos. Revisa los datos enviados en la preferencia.`, details: errorDetails };
    }
    return { success: false, error: `Error al conectar con Mercado Pago: ${errorMessage}`, details: errorDetails };
  }
}
