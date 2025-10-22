const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const TOKEN = "8352508324:AAEOAn2n_sP_imb6pCGcWWIzN4xqd-TNZk4";
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot de Telegram funcionando correctamente 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "¡Hola! Soy el bot de FaceFlex 💪");
});
