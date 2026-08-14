require("dotenv").config();

const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const interpret = require("./src/ai/interpreter");
const {
  executeChannelRename
} = require("./src/actions/channelActions");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log("=================================");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🆔 ID: ${client.user.id}`);
  console.log(`🌐 Servers: ${client.guilds.cache.size}`);
  console.log("✅ AI Discord Assistant is online");
  console.log("=================================");
});

client.on("messageCreate", async (message) => {
  try {
    // Ignore bots
    if (message.author.bot) return;

    // Only work inside servers
    if (!message.guild) return;

    // Only respond when the bot is mentioned
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
      return message.reply(
        "👋 Hey! Tell me what you want me to do."
      );
    }

    console.log(
      `[${message.guild.name}] ${message.author.tag}: ${userMessage}`
    );

    // Show Discord typing indicator
    await message.channel.sendTyping();

    // --------------------------------
    // AI UNDERSTANDS THE MESSAGE
    // --------------------------------

    const action = await interpret(userMessage);

    console.log("AI RESPONSE:");
    console.log(action);

    // --------------------------------
    // NORMAL CONVERSATION
    // --------------------------------

    if (action.action === "chat") {
      return message.reply({
        content: action.reply || "I'm here.",
        allowedMentions: {
          repliedUser: false
        }
      });
    }

    // --------------------------------
    // AI NEEDS MORE INFORMATION
    // --------------------------------

    if (action.action === "clarify") {
      return message.reply({
        content:
          `❓ ${action.question || "Can you explain what you mean?"}`,
        allowedMentions: {
          repliedUser: false
        }
      });
    }

    // --------------------------------
    // RENAME CHANNELS
    // --------------------------------

    if (action.action === "rename_channels") {
      return executeChannelRename(message, action);
    }

    // --------------------------------
    // ACTION NOT IMPLEMENTED YET
    // --------------------------------

    return message.reply({
      content:
        `🧠 I understood your request as **${action.action}**, ` +
        `but I haven't added that ability yet.`,
      allowedMentions: {
        repliedUser: false
      }
    });

  } catch (error) {
    console.error("❌ ERROR:");
    console.error(error);

    try {
      await message.reply({
        content:
          "❌ I understood your message, but something went wrong while processing it.",
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

// --------------------------------
// DISCORD ERROR HANDLING
// --------------------------------

client.on("error", (error) => {
  console.error("❌ Discord client error:", error);
});

client.on("warn", (warning) => {
  console.warn("⚠️ Discord warning:", warning);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
});

// --------------------------------
// CHECK ENVIRONMENT
// --------------------------------

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN is missing from .env"
  );
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "❌ OPENAI_API_KEY is missing from .env"
  );
  process.exit(1);
}

// --------------------------------
// LOGIN
// --------------------------------

console.log("🔄 Starting Discord bot...");

client.login(process.env.DISCORD_TOKEN);
