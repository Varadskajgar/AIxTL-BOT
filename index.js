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
  console.log(`✅ ${client.user.tag} is online`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    // Only respond when mentioned
    if (!message.mentions.users.has(client.user.id)) {
      return;
    }

    const text = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .trim();

    if (!text) {
      return message.reply(
        "👋 Tell me what you want me to do."
      );
    }

    await message.channel.sendTyping();

    // AI understands the user's message
    const action = await interpret(text);

    console.log("AI ACTION:", action);

    // AI doesn't understand
    if (action.action === "chat") {
      return message.reply(action.reply || "I understand.");
    }

    // Need clarification
    if (action.action === "clarify") {
      return message.reply(`❓ ${action.question}`);
    }

    // Currently implemented action
    if (action.action === "rename_channels") {
      return executeChannelRename(message, action);
    }

    // Future actions will be added here
    return message.reply(
      `I understood your request, but I don't have the ability to perform **${action.action}** yet.`
    );

  } catch (error) {
    console.error(error);

    return message.reply(
      "❌ Something went wrong while understanding your request."
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
