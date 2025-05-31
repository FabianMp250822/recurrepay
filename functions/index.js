/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const {parseISO} = require("date-fns");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const FINANCING_OPTIONS = {
  0: {rate: 0, label: "Sin financiación"},
  3: {rate: 0.05, label: "3 meses"},
  6: {rate: 0.08, label: "6 meses"},
  9: {rate: 0.10, label: "9 meses"},
  12: {rate: 0.12, label: "12 meses"},
};

// --- Utilidades ---

/**
 * @param {string} dateString - ISO date string.
 * @return {number} Days until due date.
 */
const getDaysUntilDue = (dateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseISO(dateString);
  dueDate.setHours(0, 0, 0, 0);
  const diffTime = dueDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * @param {string|Date} dateStringOrDate - ISO date string or Date object.
 * @return {string} Formatted date.
 */
const formatDate = (dateStringOrDate) => {
  const date = typeof dateStringOrDate === "string" ?
    parseISO(dateStringOrDate) : dateStringOrDate;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

/**
 * @param {number} amount - Amount to format.
 * @return {string} Formatted currency.
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// --- Configuración de Nodemailer (Visible en el Código) ---
const SMTP_HOST = "smtp.hostinger.com";
const SMTP_PORT = 465; // El puerto 465 implica secure: true
const SMTP_USER = "cobros@tecnosalud.cloud";
const SMTP_PASSWORD = "Tecn@2028";
const EMAIL_FROM_ADDRESS = "Recordatorios <cobros@tecnosalud.cloud>";

const mailTransport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true para el puerto 465 (SSL)
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  },
  tls: {
    // Para Hostinger, usualmente no se necesita rejectUnauthorized: false
    // si la conexión es SSL estándar al puerto 465.
    // Dejarlo como true o no especificarlo es más seguro.
    rejectUnauthorized: true,
  },
});

// --- Cloud Function Principal ---
exports.sendPaymentReminders = functions
    .runWith({
      timeoutSeconds: 300,
      memory: "256MB",
    })
    .https.onRequest(async (req, res) => {
      // --- Configuración de CORS ---
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        // Finaliza las solicitudes OPTIONS preflight
        res.status(204).send();
        return;
      }

      functions.logger.
          info("Starting sendPaymentReminders function execution.");

      try {
        // Obtener la configuración general de la app desde Firestore
        const generalSettingsSnapshot = await db.collection("appSettings")
            .doc("generalSettings")
            .get();

        if (!generalSettingsSnapshot.exists) {
          functions.logger.error("No se encontró la configuración general de la app.");
          res.status(500).send("Error interno al procesar recordatorios.");
          return;
        }

        const generalSettings = generalSettingsSnapshot.data();
        const companyName = generalSettings.appName || "RecurPay";
        const companyLogoUrl = generalSettings.appLogoUrl || "";

        const clientsSnapshot = await db.collection("listapagospendiendes")
            .where("paymentAmount", ">", 0)
            .where("status", "==", "active")
            .get();

        if (clientsSnapshot.empty) {
          functions.logger.
              info("No active clients with pending payments found.");
          res.status(200).send("No active clients to remind.");
          return;
        }

        let emailsSentCount = 0;
        const emailPromises = [];

        clientsSnapshot.forEach((doc) => {
          const client = {id: doc.id, ...doc.data()};
          const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);

          if (daysUntilDue >= -5 && daysUntilDue <= 5) {
            let subject = `Recordatorio Importante - ${companyName}`;
            const paymentAmountText = client.paymentAmount > 0 ?
              `su pago de <strong>${formatCurrency(
                  client.paymentAmount)}</strong>` :
              "su próximo compromiso de pago";

            if (client.paymentAmount > 0) {
              if (daysUntilDue < 0) {
                subject = `AVISO: Tu pago para ${client.firstName} de ${
                  formatCurrency(client.paymentAmount)} está VENCIDO`;
              } else if (daysUntilDue === 0) {
                subject = `¡Importante! Tu pago de ${
                  formatCurrency(client.paymentAmount)} para ${
                  client.firstName} vence HOY`;
              } else if (daysUntilDue === 1) {
                subject = `¡Atención! Tu pago de ${
                  formatCurrency(client.paymentAmount)} para ${
                  client.firstName} vence MAÑANA`;
              } else if (daysUntilDue <= 5) {
                subject = `Recordatorio: Tu pago de ${
                  formatCurrency(client.paymentAmount)} para ${
                  client.firstName} vence pronto`;
              }
            }

            const mailOptions = {
              from: EMAIL_FROM_ADDRESS, // Usar la constante definida arriba
              to: client.email,
              subject: subject,
              html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left">
                      <img src="${companyLogoUrl}" alt="${companyName} Logo"
                       width="150" style="margin-bottom: 20px;">
                    </td>
                    <td align="right">
                      <p style="font-size: 1.2em; color: #333;">
                        <strong>${companyName}</strong>
                      </p>
                    </td>
                  </tr>
                </table>
                <h2 style="color: #64B5F6;">Recordatorio de Pago</h2>
                <p>Estimado/a ${client.firstName} ${client.lastName},</p>
                <p>Este es un recordatorio sobre ${paymentAmountText}
                 programado para el <strong>${formatDate(client.nextPaymentDate)}</strong>.</p>
                
                ${client.contractValue && client.contractValue > 0 &&
                  client.financingPlan && client.financingPlan > 0 ? `
                <p><strong>Detalles de su financiación:</strong></p>
                <ul>
                  <li>Valor del Contrato: ${formatCurrency(
                      client.contractValue)}</li>
                  ${client.downPaymentPercentage && client.downPayment ?
                    `<li>Abono (${client.downPaymentPercentage}%): ${
                      formatCurrency(client.downPayment)}</li>` : ""}
                  <li>Plan: ${(FINANCING_OPTIONS[client.financingPlan] && FINANCING_OPTIONS[client.financingPlan].label) ||
                    `${client.financingPlan} meses`}</li>
                  <li>Cuota Mensual: ${formatCurrency(client.paymentAmount)}</li>
                </ul>
                ` : client.paymentAmount > 0 ? `
                <p><strong>Detalles del Pago Recurrente:</strong></p>
                <ul>
                  <li>Monto del Pago: ${formatCurrency(client.paymentAmount)}</li>
                  <li>Fecha de Vencimiento: ${formatDate(
                        client.nextPaymentDate)}</li>
                </ul>
                ` : ""}

                <p>Si ya ha realizado este pago, por favor ignore este correo.
                 Si tiene alguna pregunta o necesita actualizar su información
                  de pago, no dude en contactarnos.</p>

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left">
                      <p>¡Gracias por su preferencia!</p>
                      <p>Atentamente,</p>
                      <p><strong>El Equipo de ${companyName}</strong></p>
                    </td>
                    <td align="right">
                      <img src="${companyLogoUrl}" alt="${companyName} Logo"
                       width="70" style="margin-bottom: 20px;">
                    </td>
                  </tr>
                </table>

                <hr style="border: none; border-top: 1px solid #E3F2FD;
                 margin-top: 20px; margin-bottom: 10px;" />
                <p style="font-size: 0.8em; color: #777;">
                  Este es un mensaje automático de ${companyName}.
                   Por favor, no responda directamente a este correo
                    electrónico.
                </p>
              </div>
            `,
            };

            functions.logger.info(`Preparando correo para ${client.email},
             asunto: ${subject}`);
            emailPromises.push(
                mailTransport.sendMail(mailOptions)
                    .then(() => {
                      emailsSentCount++;
                      functions.logger.info(
                          `Correo de recordatorio enviado a ${client.email}`);
                    })
                    .catch((error) => {
                      functions.logger.error(
                          `Error al enviar correo a ${client.email}:`, error);
                    }),
            );
          }
        });

        await Promise.all(emailPromises);
        functions.logger.info(`Proceso completado. Total de correos enviados: ${emailsSentCount}`);
        res.status(200).send(
            `Proceso completado. Correos enviados: ${emailsSentCount}`);
      } catch (error) {
        functions.logger.error(
            "Error en la función sendPaymentReminders:", error);
        res.status(500).send("Error interno al procesar recordatorios.");
      }
    });
