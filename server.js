// server.js
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");

// --- IMPORTANT: PASTE YOUR DETAILS HERE ---
// Get your Bot Token from BotFather on Telegram
const token = "8350824476:AAEk31F_TaraYZBfwltuBU9Ebvc11AV4b-k";

// Get your Chat ID from @userinfobot on Telegram
const chatId = "1283168709";

// --- SERVER SETUP ---
const bot = new TelegramBot(token);
const app = express();

app.use(cors()); // Allows your React app to talk to this server
app.use(express.json()); // Allows server to read JSON data

// This is our notification endpoint
app.post("/notify", (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).send({ error: "Message is required" });
  }

  // Send the message using the bot
  bot
    .sendMessage(chatId, message)
    .then(() => {
      console.log(`Notification sent to Telegram: "${message}"`);
      res.status(200).send({ status: "Notification sent successfully" });
    })
    .catch((error) => {
      console.error("Telegram Error:", error.code, "-", error.response.body);
      res.status(500).send({ error: "Failed to send notification" });
    });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log("Waiting for actions from the React app...");
});
