
'use server';

import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function testMercadoPagoPreferenceCreation() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("Error: MERCADOPAGO_ACCESS_TOKEN no está configurado en las variables de entorno.");
    return { success: false, error: "Access Token no configurado." };
  }

  try {
    console.log("Iniciando prueba de Mercado Pago con Access Token:", accessToken.substring(0, 15) + "..."); // No loguear el token completo en producción real

    const client = new MercadoPagoConfig({ accessToken: accessToken, options: { timeout: 5000 } });
    const preference = new Preference(client);

    console.log("Creando preferencia de prueba...");
    const result = await preference.create({
      body: {
        items: [
          {
            id: 'test_item_123',
            title: 'Producto de Prueba RecurPay',
            quantity: 1,
            unit_price: 100.50,
            currency_id: 'COP', // Asegúrate que esta moneda es aceptada por tus credenciales de prueba
            description: 'Descripción del producto de prueba',
            category_id: 'services', // O una categoría válida
          },
        ],
        payer: {
          email: 'test_user@testuser.com', // Email de prueba
        },
        back_urls: {
          success: 'http://localhost:3000/success', // URLs de ejemplo
          failure: 'http://localhost:3000/failure',
          pending: 'http://localhost:3000/pending',
        },
        auto_return: 'approved',
        external_reference: 'RecurPayTest_12345',
        notification_url: 'https://example.com/api/mp_webhook', // URL de webhook de ejemplo
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
    // Intentar obtener más detalles del error de Mercado Pago si está disponible
    const errorMessage = error.cause?.message || error.message || "Error desconocido";
    const errorDetails = error.cause || error;
    console.error("Detalles del error de Mercado Pago:", JSON.stringify(errorDetails, null, 2));
    return { success: false, error: `Error al conectar con Mercado Pago: ${errorMessage}`, details: errorDetails };
  }
}
