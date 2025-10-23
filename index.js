import express from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import nodemailer from "nodemailer";

const app = express();
app.use(bodyParser.json());

// ================== CONFIGURACIÓN ==================
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8352508324:AAEOAn2n_sP_imb6pCGcWWIzN4xqd-TNZk4";
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || "-1003193574817"; // ojo: suele empezar con -100

// Email para notificaciones
const EMAIL_USER = process.env.EMAIL_USER; // cuenta remitente
const EMAIL_PASS = process.env.EMAIL_PASS; // app password
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL; // tu email personal para alertas

// Token de seguridad del webhook (Hotmart → Herramientas → Webhooks)
const HOTMART_HOTTOK = process.env.HOTMART_HOTTOK || "tu_hottok_secreto";

// ===================================================

// Crear bot de Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Configuración de mailer (SMTP)
let mailer = null;
if (EMAIL_USER && EMAIL_PASS) {
  mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

// ================== ENDPOINT HOTMART ==================
app.post("/webhook", async (req, res) => {
  try {
    // Validación del hottok
    const hottokHeader = req.headers["hottok"] || req.headers["Hottok"];
    if (HOTMART_HOTTOK && hottokHeader !== HOTMART_HOTTOK) {
      console.warn("Webhook rechazado, hottok inválido");
      return res.status(403).send("Forbidden");
    }

    const body = req.body || {};
    console.log("Webhook Hotmart recibido:", JSON.stringify(body, null, 2));

    const event = body.event || body.event_type || body.type || "";
    const data = body.data || body || {};
    const buyer = data.buyer || data.customer || {};
    const buyerEmail = (buyer.email || data.email || "").toLowerCase();
    const buyerName = buyer.name || buyer.full_name || data.name || "Sin nombre";
    const product = data.product || data.product_name || "Sin producto";
    const purchaseId = data.purchase?.purchase_id || data.purchase_id || "Sin ID";
    const timestamp = new Date().toISOString();

    // === Cancelaciones o expiraciones ===
    const isCancellation = [
      "PURCHASE_CANCELED",
      "PURCHASE_EXPIRED",
      "PURCHASE_REFUNDED",
      "subscription.canceled",
      "subscription.expired",
    ].includes(event);

    if (isCancellation) {
      const subject = `[ALERTA] Suscripción cancelada/expirada - ${buyerEmail}`;
      const text = `Se detectó una cancelación/expiración en Hotmart.

Evento: ${event}
Fecha: ${timestamp}

Datos:
- Nombre: ${buyerName}
- Email: ${buyerEmail}
- Producto: ${product}
- Purchase ID: ${purchaseId}

Acción recomendada:
👉 Revisar en Hotmart y eliminar manualmente al usuario del grupo de Telegram si corresponde.

Payload recibido:
${JSON.stringify(body, null, 2)}
`;

      if (mailer && ADMIN_ALERT_EMAIL) {
        await mailer.sendMail({
          from: `"FaceFlex Alerts" <${EMAIL_USER}>`,
          to: ADMIN_ALERT_EMAIL,
          subject,
          text,
        });
        console.log("✅ Email de cancelación enviado a:", ADMIN_ALERT_EMAIL);
      } else {
        console.log("[SIMULACIÓN] Email de cancelación:\n", text);
      }

      return res.status(200).send("Alerta enviada");
    }

    // === Compras aprobadas ===
    if (event === "PURCHASE_APPROVED") {
      await bot.sendMessage(
        TELEGRAM_GROUP_ID,
        `🎉 Bienvenida ${buyerName}! Tu suscripción está activa.`
      );

      if (mailer && ADMIN_ALERT_EMAIL) {
        await mailer.sendMail({
          from: `"FaceFlex Alerts" <${EMAIL_USER}>`,
          to: ADMIN_ALERT_EMAIL,
          subject: `[INFO] Nueva compra aprobada - ${buyerEmail}`,
          text: `Se aprobó una compra:\n\nNombre: ${buyerName}\nEmail: ${buyerEmail}\nProducto: ${product}\nPurchase ID: ${purchaseId}`,
        });
      }

      return res.status(200).send("Compra procesada");
    }

    // Otros eventos → solo log
    console.log("Evento no manejado:", event);
    res.status(200).send("Evento ignorado");
  } catch (err) {
    console.error("Error procesando webhook:", err);
    res.status(500).send("Error interno");
  }
});

// ================== SERVIDOR ==================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
);
