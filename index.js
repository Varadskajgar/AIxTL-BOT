require("dotenv").config();

const express = require("express");

const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const interpret = require("./src/ai/interpreter");

const {
  executeChannelRename
} = require("./src/actions/channelActions");

// ==========================================
// WEB SERVER FOR RENDER
// ==========================================

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("🤖 AI Discord Bot is online!");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "online",
    bot: client.user ? client.user.tag : "starting"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ==========================================
// DISCORD CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================================
// BOT READY
// ==========================================

client.once("ready", () => {
  console.log("=================================");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🆔 ID: ${client.user.id}`);
  console.log(`🌐 Servers: ${client.guilds.cache.size}`);
  console.log("✅ AI Discord Assistant is online");
  console.log("=================================");
});

// ==========================================
// MESSAGE HANDLER
// ==========================================

client.on("messageCreate", async (message) => {
  try {

    // Ignore bots
    if (message.author.bot) return;

    // Ignore DMs
    if (!message.guild) return;

    // Only respond when bot is mentioned
    if (!message.mentions.users.has(client.user.id)) {
      return;
    }

    // Remove bot mention
    const mentionRegex = new RegExp(
      `<@!?${client.user.id}>`,
      "g"
    );

    const userMessage = message.content
      .replace(mentionRegex, "")
      .trim();

    // Empty message
    if (!userMessage) {
      return message.reply({
        content:
          "👋 Hey! Tell me what you want me to do.",
        allowedMentions: {
          repliedUser: false
        }
      });
    }

    console.log("---------------------------------");
    console.log(`👤 User: ${message.author.tag}`);
    console.log(`💬 Message: ${userMessage}`);

    // Discord typing indicator
    await message.channel.sendTyping();

    // ======================================
    // AI UNDERSTANDS USER
    // ======================================

    const action = await interpret(userMessage);

    console.log("🧠 AI Action:");
    console.log(action);

    // ======================================
    // NORMAL CHAT
    // ======================================

    if (action.action === "chat") {

      return message.reply({
        content:
          action.reply || "I'm here.",
        allowedMentions: {
          repliedUser: false
        }
      });
    }

    // ======================================
    // AI NEEDS CLARIFICATION
    // ======================================

    if (action.action === "clarify") {

      return message.reply({
        content:
          `❓ ${action.question || "Can you explain what you mean?"}`,
        allowedMentions: {
          repliedUser: false
        }
      });
    }

    // ======================================
    // RENAME CHANNELS
    // ======================================

    if (action.action === "rename_channels") {

      return executeChannelRename(
        message,
        action
      );
    }

    // ======================================
    // ACTION NOT AVAILABLE YET
    // ======================================

    return message.reply({
      content:
        `🧠 I understood your request as **${action.action}**, ` +
        `but I haven't learned how to perform that action yet.`,
      allowedMentions: {
        repliedUser: false
      }
    });

  } catch (error) {

    console.error("=================================");
    console.error("❌ MESSAGE ERROR");
    console.error(error);
    console.error("=================================");

    try {

      await message.reply({
        content:
          "❌ Something went wrong while processing your request.",
        allowedMentions: {
          repliedUser: false
        }
      });

    } catch (replyError) {

      console.error(
        "❌ Could not send error message:",
        replyError
      );
    }
  }
});

// ==========================================
// DISCORD ERRORS
// ==========================================

client.on("error", (error) => {
  console.error("❌ Discord Client Error:");
  console.error(error);
});

client.on("warn", (warning) => {
  console.warn("⚠️ Discord Warning:");
  console.warn(warning);
});

// ==========================================
// NODE ERRORS
// ==========================================

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled Promise Rejection:");
  console.error(error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:");
  console.error(error);
});

// ==========================================
// ENVIRONMENT CHECK
// ==========================================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN is missing!"
  );

  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {

  console.error(
    "❌ OPENAI_API_KEY is missing!"
  );

  process.exit(1);
}

// ==========================================
// START DISCORD BOT
// ==========================================

console.log("🔄 Starting Discord bot...");

client.login(
  process.env.DISCORD_TOKEN
);
