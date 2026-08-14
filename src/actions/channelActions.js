const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

// ============================================================
// CHANNEL ACTIONS
// ============================================================
//
// Supports:
//   rename channels
//   simple channel names
//   prefix names
//   replace names
//   create channels/categories
//   delete channels/categories
//   undo rename
//   undo create
//   recreate deleted channels/categories
//
// IMPORTANT:
// Discord cannot restore the original ID of a deleted channel.
// Undo delete recreates the channel with its saved settings.
// ============================================================


// ============================================================
// HISTORY
// ============================================================

if (!global.aixHistory) {
  global.aixHistory = new Map();
}

function getHistory(guildId) {
  if (!global.aixHistory.has(guildId)) {
    global.aixHistory.set(guildId, []);
  }

  return global.aixHistory.get(guildId);
}

function saveHistory(guildId, entry) {
  const history = getHistory(guildId);

  history.push(entry);

  // Keep last 20 operations
  if (history.length > 20) {
    history.shift();
  }
}


// ============================================================
// DELAY
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// PERMISSION CHECK
// ============================================================

function checkPermissions(message) {
  if (!message.guild) {
    return "❌ This command can only be used inside a server.";
  }

  if (
    !message.member ||
    !message.member.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return "❌ You need **Manage Channels** permission.";
  }

  const botMember = message.guild.members.me;

  if (!botMember) {
    return "❌ I couldn't find my server member.";
  }

  if (
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return "❌ I need **Manage Channels** permission.";
  }

  return null;
}


// ============================================================
// FANCY LETTER CONVERSION
// ============================================================

const fancyMap = {
  "ᴀ": "a",
  "ʙ": "b",
  "ᴄ": "c",
  "ᴅ": "d",
  "ᴇ": "e",
  "ғ": "f",
  "ɢ": "g",
  "ʜ": "h",
  "ɪ": "i",
  "ᴊ": "j",
  "ᴋ": "k",
  "ʟ": "l",
  "ᴍ": "m",
  "ɴ": "n",
  "ᴏ": "o",
  "ᴘ": "p",
  "ǫ": "q",
  "ʀ": "r",
  "s": "s",
  "ᴛ": "t",
  "ᴜ": "u",
  "ᴠ": "v",
  "ᴡ": "w",
  "x": "x",
  "ʏ": "y",
  "ᴢ": "z",

  "ᶜ": "c",
  "ᵈ": "d",
  "ᵉ": "e",
  "ᵍ": "g",
  "ʰ": "h",
  "ᶦ": "i",
  "ʲ": "j",
  "ᵏ": "k",
  "ˡ": "l",
  "ᵐ": "m",
  "ⁿ": "n",
  "ᵒ": "o",
  "ᵖ": "p",
  "ʳ": "r",
  "ᵗ": "t",
  "ᵘ": "u",
  "ᵛ": "v",
  "ʷ": "w",
  "ˣ": "x",
  "ʸ": "y"
};


// ============================================================
// SIMPLE NAME
// ============================================================
//
// Example:
//
//  "〢ᴏᴡᴏ"             -> "owo"
//  "〢team-legends"     -> "team legends"
//  "ɢᴀᴍɪɴɢ ᴠᴄ"        -> "gaming vc"
//  "🎮・GENERAL"       -> "general"
//  "rules!!"           -> "rules"
//
// Only normal a-z, 0-9 and spaces remain.
// ============================================================

function simpleName(name) {
  let result = String(name || "");

  result = [...result]
    .map(char => fancyMap[char] || char)
    .join("");

  result = result.toLowerCase();

  // Everything except normal letters/numbers becomes space
  result = result.replace(/[^a-z0-9\s]/g, " ");

  // Multiple spaces -> one space
  result = result.replace(/\s+/g, " ").trim();

  if (!result) {
    result = "channel";
  }

  // Discord channel names have a max length
  return result.slice(0, 100);
}


// ============================================================
// CHANNEL TARGETS
// ============================================================

function getTargets(guild, target) {
  const all = [...guild.channels.cache.values()];

  if (target === "category") {
    return all.filter(
      channel =>
        channel.type === ChannelType.GuildCategory
    );
  }

  // Default = channels, excluding categories
  return all.filter(
    channel =>
      channel.type !== ChannelType.GuildCategory
  );
}


// ============================================================
// CALCULATE NEW NAME
// ============================================================

function calculateName(channel, action) {
  const mode = String(action.mode || "simple").toLowerCase();

  // ----------------------------
  // SIMPLE
  // ----------------------------

  if (mode === "simple") {
    return simpleName(channel.name);
  }

  // ----------------------------
  // REPLACE
  // ----------------------------

  if (mode === "replace") {
    return String(action.name || "")
      .trim()
      .slice(0, 100);
  }

  // ----------------------------
  // PREFIX
  // ----------------------------

  if (mode === "prefix") {
    const prefix = String(action.prefix || "");
    const separator = action.space ? " " : "";

    return (
      `${prefix}${separator}${channel.name}`
    ).slice(0, 100);
  }

  return null;
}


// ============================================================
// CONFIRMATION
// ============================================================

async function confirmAction(
  message,
  title,
  description,
  callback
) {
  const yesId =
    `aix_yes_${message.author.id}_${Date.now()}`;

  const noId =
    `aix_no_${message.author.id}_${Date.now()}`;

  const row =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId(yesId)
        .setLabel("Agree")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(noId)
        .setLabel("Cancel")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)

    );

  const embed =
    new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setFooter({
        text:
          "Nothing will happen until you press Agree."
      });

  const reply =
    await message.reply({
      embeds: [embed],
      components: [row],
      allowedMentions: {
        repliedUser: false
      }
    });

  const collector =
    reply.createMessageComponentCollector({
      time: 60_000
    });

  collector.on(
    "collect",
    async interaction => {

      // ----------------------------------------
      // WRONG USER
      // ----------------------------------------

      if (
        interaction.user.id !==
        message.author.id
      ) {
        try {
          await interaction.reply({
            content:
              "❌ Only the person who requested this can confirm it.",
            ephemeral: true
          });
        } catch {}

        return;
      }

      // ----------------------------------------
      // CANCEL
      // ----------------------------------------

      if (
        interaction.customId === noId
      ) {
        try {
          await interaction.deferUpdate();

          collector.stop("cancelled");

          await reply.edit({
            content:
              "❌ Cancelled. Nothing was changed.",
            embeds: [],
            components: []
          });
        } catch (error) {
          console.error(
            "Cancel error:",
            error
          );
        }

        return;
      }

      // ----------------------------------------
      // AGREE
      // ----------------------------------------

      if (
        interaction.customId === yesId
      ) {
        try {

          await interaction.deferUpdate();

          await reply.edit({
            content:
              "⏳ Working...",
            embeds: [],
            components: []
          });

          const result =
            await callback();

          collector.stop("completed");

          await reply.edit({
            content: result,
            embeds: [],
            components: []
          });

        } catch (error) {

          console.error(
            "Action error:",
            error
          );

          collector.stop("error");

          try {
            await reply.edit({
              content:
                "❌ Operation failed:\n```" +
                `${error.message}` +
                "```",
              embeds: [],
              components: []
            });
          } catch {}
        }
      }

    }
  );

  collector.on(
    "end",
    async (_, reason) => {

      if (reason !== "time") {
        return;
      }

      try {
        await reply.edit({
          content:
            "⌛ Confirmation expired. Nothing was changed.",
          embeds: [],
          components: []
        });
      } catch {}
    }
  );
}


// ============================================================
// RENAME CHANNELS
// ============================================================

async function executeRename(
  message,
  action
) {
  const permissionError =
    checkPermissions(message);

  if (permissionError) {
    return message.reply({
      content: permissionError,
      allowedMentions: {
        repliedUser: false
      }
    });
  }

  const target =
    action.target || "channel";

  let channels =
    getTargets(
      message.guild,
      target
    );

  // ==========================================================
  // CURRENT
  // ==========================================================

  if (
    action.scope === "current"
  ) {

    if (target === "channel") {

      if (
        message.channel.type ===
        ChannelType.GuildCategory
      ) {
        return message.reply(
          "❌ This is a category, not a channel."
        );
      }

      channels = [
        message.channel
      ];

    } else {

      const category =
        message.channel.type ===
        ChannelType.GuildCategory
          ? message.channel
          : message.channel.parent;

      if (!category) {
        return message.reply(
          "❌ I couldn't find the current category."
        );
      }

      channels = [
        category
      ];
    }
  }

  // ==========================================================
  // NAMED
  // ==========================================================

  if (
    action.scope === "named"
  ) {

    const wanted =
      String(
        action.oldName ||
        action.name ||
        ""
      )
        .toLowerCase()
        .trim();

    const found =
      channels.find(
        channel =>
          channel.name
            .toLowerCase() ===
          wanted
      );

    if (!found) {
      return message.reply(
        `❌ I couldn't find ${target} **${wanted}**.`
      );
    }

    channels = [
      found
    ];
  }

  // ==========================================================
  // MANAGEABLE
  // ==========================================================

  const manageable =
    channels.filter(
      channel =>
        channel.manageable
    );

  const skipped =
    channels.length -
    manageable.length;

  if (
    manageable.length === 0
  ) {
    return message.reply(
      "❌ I couldn't find any manageable targets."
    );
  }

  // ==========================================================
  // PREVIEW
  // ==========================================================

  let preview = "";

  for (
    const channel of
    manageable.slice(0, 25)
  ) {

    const newName =
      calculateName(
        channel,
        action
      );

    preview +=
      `\`${channel.name}\` → \`${newName}\`\n`;
  }

  if (
    manageable.length > 25
  ) {
    preview +=
      `\n…and ${
        manageable.length - 25
      } more.`;
  }

  await confirmAction(

    message,

    "🔄 Rename Confirmation",

    `**Target:** ${target}\n` +
    `**Channels:** ${manageable.length}\n` +
    `**Mode:** ${action.mode || "simple"}\n\n` +
    preview,

    async () => {

      const changes = [];

      let changed = 0;
      let failed = 0;

      for (
        const channel of
        manageable
      ) {

        const oldName =
          channel.name;

        const newName =
          calculateName(
            channel,
            action
          );

        if (
          !newName ||
          newName === oldName
        ) {
          continue;
        }

        try {

          await channel.setName(
            newName,
            "AI Discord management"
          );

          changes.push({
            type: "rename",
            channelId: channel.id,
            oldName,
            newName
          });

          changed++;

          console.log(
            `✅ Renamed: ${oldName} -> ${newName}`
          );

          await sleep(350);

        } catch (error) {

          failed++;

          console.error(
            `❌ Rename failed: ${oldName}`,
            error.message
          );
        }
      }

      if (changes.length > 0) {
        saveHistory(
          message.guild.id,
          {
            type: "rename",
            changes
          }
        );
      }

      return (
        `✅ Rename complete.\n\n` +
        `Changed: **${changed}**\n` +
        `Failed: **${failed}**\n` +
        `Skipped: **${skipped}**`
      );
    }
  );
}


// ============================================================
// CREATE CHANNELS
// ============================================================

async function executeCreate(
  message,
  action
) {
  const permissionError =
    checkPermissions(message);

  if (permissionError) {
    return message.reply({
      content: permissionError,
      allowedMentions: {
        repliedUser: false
      }
    });
  }

  const target =
    action.target || "channel";

  const count =
    Math.max(
      1,
      Math.min(
        Number(action.count) || 1,
        100
      )
    );

  let names =
    Array.isArray(action.names)
      ? action.names
      : [];

  names =
    names
      .map(name =>
        String(name || "")
          .trim()
          .slice(0, 100)
      )
      .filter(Boolean);

  if (names.length === 0) {
    names = [
      "new-channel"
    ];
  }

  // ==========================================================
  // FIND CATEGORY
  // ==========================================================

  let category = null;

  if (
    target === "channel" &&
    action.category
  ) {

    const wanted =
      String(action.category)
        .toLowerCase()
        .trim();

    category =
      message.guild.channels.cache.find(
        channel =>
          channel.type ===
          ChannelType.GuildCategory &&
          channel.name
            .toLowerCase() ===
          wanted
      );

    if (!category) {
      return message.reply(
        `❌ Category **${action.category}** was not found.`
      );
    }
  }

  // ==========================================================
  // PREVIEW
  // ==========================================================

  let preview = "";

  for (
    let i = 0;
    i < Math.min(count, 20);
    i++
  ) {

    const name =
      names[i % names.length];

    preview +=
      `• \`${name}\`\n`;
  }

  if (count > 20) {
    preview +=
      `\n…and ${
        count - 20
      } more.`;
  }

  await confirmAction(

    message,

    "➕ Create Confirmation",

    `**Target:** ${target}\n` +
    `**Count:** ${count}\n` +
    `**Category:** ${
      category
        ? category.name
        : "None"
    }\n\n` +
    preview,

    async () => {

      const created = [];

      let failed = 0;

      for (
        let i = 0;
        i < count;
        i++
      ) {

        const name =
          names[i % names.length];

        try {

          const channel =
            await message.guild.channels.create({
              name,
              type:
                target === "category"
                  ? ChannelType.GuildCategory
                  : ChannelType.GuildText,

              parent:
                target === "channel"
                  ? category?.id || null
                  : null,

              reason:
                "AI Discord management"
            });

          created.push({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parentId: channel.parentId
          });

          console.log(
            `✅ Created: ${channel.name}`
          );

          await sleep(500);

        } catch (error) {

          failed++;

          console.error(
            `❌ Create failed: ${name}`,
            error.message
          );
        }
      }

      if (created.length > 0) {
        saveHistory(
          message.guild.id,
          {
            type: "create",
            created
          }
        );
      }

      return (
        `✅ Creation complete.\n\n` +
        `Created: **${created.length}**\n` +
        `Failed: **${failed}**`
      );
    }
  );
}


// ============================================================
// DELETE CHANNELS
// ============================================================

async function executeDelete(
  message,
  action
) {
  const permissionError =
    checkPermissions(message);

  if (permissionError) {
    return message.reply({
      content: permissionError,
      allowedMentions: {
        repliedUser: false
      }
    });
  }

  const target =
    action.target || "channel";

  let channels =
    getTargets(
      message.guild,
      target
    );

  // ==========================================================
  // CURRENT
  // ==========================================================

  if (
    action.scope === "current"
  ) {

    if (
      target === "channel"
    ) {

      if (
        message.channel.type ===
        ChannelType.GuildCategory
      ) {
        return message.reply(
          "❌ This is a category, not a channel."
        );
      }

      channels = [
        message.channel
      ];

    } else {

      const category =
        message.channel.type ===
        ChannelType.GuildCategory
          ? message.channel
          : message.channel.parent;

      if (!category) {
        return message.reply(
          "❌ I couldn't find the current category."
        );
      }

      channels = [
        category
      ];
    }
  }

  // ==========================================================
  // NAMED
  // ==========================================================

  if (
    action.scope === "named"
  ) {

    const wanted =
      String(
        action.name || ""
      )
        .toLowerCase()
        .trim();

    const found =
      channels.find(
        channel =>
          channel.name
            .toLowerCase() ===
          wanted
      );

    if (!found) {
      return message.reply(
        `❌ I couldn't find ${target} **${wanted}**.`
      );
    }

    channels = [
      found
    ];
  }

  // ==========================================================
  // MANAGEABLE
  // ==========================================================

  const manageable =
    channels.filter(
      channel =>
        channel.manageable
    );

  const skipped =
    channels.length -
    manageable.length;

  if (
    manageable.length === 0
  ) {
    return message.reply(
      "❌ I couldn't find anything I can delete."
    );
  }

  // ==========================================================
  // BACKUP
  // ==========================================================

  const backups =
    manageable.map(channel => ({
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId || null,

      topic:
        "topic" in channel
          ? channel.topic || null
          : null,

      nsfw:
        "nsfw" in channel
          ? Boolean(channel.nsfw)
          : false,

      rateLimitPerUser:
        "rateLimitPerUser" in channel
        
