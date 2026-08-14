const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

// ======================================================
// HISTORY
// ======================================================

// In-memory history.
// This survives an undo during the current bot session.
// A database can be added later for permanent recovery.

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

  const history =
    getHistory(guildId);

  history.push(entry);

  // Keep last 20 operations
  if (history.length > 20) {
    history.shift();
  }
}

// ======================================================
// PERMISSION
// ======================================================

function checkPermissions(message) {

  if (
    !message.member.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {

    return "❌ You need **Manage Channels** permission.";

  }

  const bot =
    message.guild.members.me;

  if (
    !bot ||
    !bot.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {

    return "❌ I need **Manage Channels** permission.";

  }

  return null;
}

// ======================================================
// SIMPLE NAME
// ======================================================

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
  "ᴛ": "t",
  "ᴜ": "u",
  "ᴠ": "v",
  "ᴡ": "w",
  "ʏ": "y",
  "ᴢ": "z"
};

function simpleName(name) {

  let result =
    String(name || "");

  result = [...result]
    .map(c => fancyMap[c] || c)
    .join("");

  result =
    result.toLowerCase();

  // ONLY normal letters, numbers and spaces
  result =
    result.replace(
      /[^a-z0-9\s]/g,
      " "
    );

  result =
    result
      .replace(/\s+/g, " ")
      .trim();

  if (!result) {
    result = "channel";
  }

  return result.slice(0, 100);
}

// ======================================================
// TARGET FINDER
// ======================================================

function getTargets(guild, target) {

  return [
    ...guild.channels.cache.values()
  ].filter(channel => {

    if (target === "channel") {

      return (
        channel.type !==
        ChannelType.GuildCategory
      );

    }

    if (target === "category") {

      return (
        channel.type ===
        ChannelType.GuildCategory
      );

    }

    return false;

  });
}

// ======================================================
// NEW NAME
// ======================================================

function calculateName(channel, action) {

  if (action.mode === "replace") {

    return String(
      action.name || ""
    )
      .trim()
      .slice(0, 100);

  }

  if (action.mode === "simple") {

    return simpleName(
      channel.name
    );

  }

  if (action.mode === "prefix") {

    return (
      String(action.prefix || "") +
      (action.space ? " " : "") +
      channel.name
    ).slice(0, 100);

  }

  return null;
}

// ======================================================
// CONFIRMATION
// ======================================================

async function confirmAction(
  message,
  title,
  description,
  callback
) {

  const row =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `aix_yes_${message.author.id}`
          )
          .setLabel("Agree")
          .setEmoji("✅")
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            `aix_no_${message.author.id}`
          )
          .setLabel("Cancel")
          .setEmoji("❌")
          .setStyle(
            ButtonStyle.Danger
          )

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

      if (
        interaction.user.id !==
        message.author.id
      ) {

        return interaction.reply({

          content:
            "❌ Only the person who requested this can confirm it.",

          ephemeral: true

        });

      }

      if (
        interaction.customId ===
        `aix_no_${message.author.id}`
      ) {

        await interaction.deferUpdate();

        collector.stop(
          "cancelled"
        );

        return reply.edit({

          content:
            "❌ Cancelled. Nothing was changed.",

          embeds: [],

          components: []

        });

      }

      if (
        interaction.customId ===
        `aix_yes_${message.author.id}`
      ) {

        await interaction.deferUpdate();

        await reply.edit({

          content:
            "⏳ Working...",

          embeds: [],

          components: []

        });

        try {

          const result =
            await callback();

          collector.stop(
            "completed"
          );

          return reply.edit({

            content:
              result,

            embeds: [],

            components: []

          });

        } catch (error) {

          console.error(error);

          collector.stop(
            "error"
          );

          return reply.edit({

            content:
              "❌ Operation failed: " +
              error.message,

            embeds: [],

            components: []

          });

        }

      }

    }
  );

  collector.on(
    "end",
    async (_, reason) => {

      if (
        reason !== "time"
      ) {
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

// ======================================================
// RENAME
// ======================================================

async function executeRename(
  message,
  action
) {

  const permissionError =
    checkPermissions(message);

  if (permissionError) {
    return message.reply(
      permissionError
    );
  }

  const target =
    action.target || "channel";

  let channels =
    getTargets(
      message.guild,
      target
    );

  // ------------------------------------------
  // CURRENT
  // ------------------------------------------

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

  // ------------------------------------------
  // NAMED
  // ------------------------------------------

  if (
    action.scope === "named"
  ) {

    const wanted =
      String(action.oldName || action.name || "")
        .toLowerCase()
        .trim();

    const found =
      channels.find(
        c =>
          c.name
            .toLowerCase()
            === wanted
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

  // ------------------------------------------
  // MANAGEABLE ONLY
  // ------------------------------------------

  const manageable =
    channels.filter(
      c => c.manageable
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

  // ------------------------------------------
  // PREVIEW
  // ------------------------------------------

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

    `**Target:** ${target}s\n` +
    `**Count:** ${manageable.length}\n` +
    `**Mode:** ${action.mode}\n\n` +
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

          await new Promise(
            r => setTimeout(r, 350)
          );

        } catch (error) {

          failed++;

          console.error(
            `Rename failed: ${oldName}`,
            error.message
          );

        }

      }

      if (changes.length) {

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

// ======================================================
// CREATE
// ======================================================

async function executeCreate(
  message,
  action
) {

  const permissionError =
    checkPermissions(message);

  if (permissionError) {
    return message.reply(
      permissionError
    );
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

  const names =
    Array.isArray(action.names) &&
    action.names.length
      ? action.names
      : ["new-channel"];

  let category = null;

  if (
    target === "channel" &&
    action.category
  ) {

    category =
      message.guild.channels.cache.find(
        c =>
          c.type ===
          ChannelType.GuildCategory &&
          c.name.toLowerCase() ===
          String(action.category)
            .toLowerCase()
            .trim()
      );

    if (!category) {

      return message.reply(
        `❌ Category **${action.category}** was not found.`
      );

    }

  }

  let preview = "";

  for (
    let i = 0;
    i < Math.min(count, 20);
    i++
  ) {

    const name =
      String(
        names[i % names.length]
      )
        .trim()
        .slice(0, 100);

    preview +=
      `\`${name}\`\n`;

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
          String(
            names[i % names.length]
          )
            .trim()
            .slice(0, 100);

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
            type: target
          });

          await new Promise(
            r => setTimeout(r, 500)
          );

        } catch (error) {

          failed++;

          console.error(
            `Create failed: ${name}`,
            error.message
          );

        }

      }

      if (created.length) {

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

// ======================================================
// DELETE
// ======================================================

async function executeDelete(
  message,
  action
) {

  const permissionError =
    checkPermissions(message);

  if (permissionError) {
    return message.reply(
      permissionError
    );
  }

  const target =
    action.target || "channel";

  let channels =
    getTargets(
      message.guild,
      target
    );

  // ------------------------------------------
  // CURRENT
  // ------------------------------------------

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

  // ------------------------------------------
  // NAMED
  // ------------------------------------------

  if (
    action.scope === "named"
  ) {

    const wanted =
      String(action.name || "")
        .toLowerCase()
        .trim();

    const found =
      channels.find(
        c =>
          c.name
            .toLowerCase()
            === wanted
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

  const manageable =
    channels.filter(
      c => c.manageable
    );

  if (
    manageable.length === 0
  ) {

    return message.reply(
      "❌ I couldn't find anything I can delete."
    );

  }

  // ------------------------------------------
  // SAVE INFO BEFORE DELETE
  // ------------------------------------------

  const backups =
    manageable.map(
      channel => ({

        name:
          channel.name,

        type:
          channel.type,

        parentId:
          channel.parentId,

        topic:
          channel.topic || null,

        nsfw:
          channel.nsfw || false,

        rateLimitPerUser:
          channel.rateLimitPerUser || 0

      })
    );

  let preview =
    manageable
      .slice(0, 25)
      .map(
        c => `• ${c.name}`
      )
      .join("\n");

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

    "⚠️ Delete Confirmation",

    `**Target:** ${target}s\n` +
    `**Count:** ${manageable.length}\n\n` +
    preview,

    async () => {

      let deleted = 0;
      let failed = 0;

      for (
        const channel of
        manageable
      ) {

        try {

          await channel.delete(
            "AI Discord management"
          );

          deleted++;

          await new Promise(
            r => setTimeout(r, 500)
          );

        } catch (error) {

          failed++;

          console.error(
            `Delete failed: ${channel.name}`,
            error.message
          );

        }

      }

      saveHistory(
        message.guild.id,
        {
          type: "delete",
          backups
        }
      );

      return (
        `🗑️ Delete complete.\n\n` +
        `Deleted: **${deleted}**\n` +
        `Failed: **${failed}**\n\n` +
        `The deleted objects have been saved for **undo** during this bot session.`
      );

    }

  );
}

// ======================================================
// UNDO
// ======================================================

async function executeUndo(
  message
) {

  const permissionError =
    checkPermissions(message);

  if (permissionError) {
    return message.reply(
      permissionError
    );
  }

  const history =
    getHistory(
      message.guild.id
    );

  if (
    history.length === 0
  ) {

    return message.reply(
      "ℹ️ There is nothing to undo."
    );

  }

  const last =
    history.pop();

  // ==================================================
  // UNDO RENAME
  // ==================================================

  if (
    last.type === "rename"
  ) {

    let restored = 0;
    let failed = 0;

    for (
      const change of
      last.changes.reverse()
    ) {

      const channel =
        message.guild.channels.cache.get(
          change.channelId
        );

      if (!channel) {
        failed++;
        continue;
      }

      try {

        await channel.setName(
          change.oldName,
          "AI undo"
        );

        restored++;

        await new Promise(
          r => setTimeout(r, 350)
        );

      } catch {

        failed++;

      }

    }

    return message.reply(
      `↩️ Undo complete.\n\nRestored: **${restored}**\nFailed: **${failed}**`
    );

  }

  // ==================================================
  // UNDO CREATE
  // ==================================================

  if (
    last.type === "create"
  ) {

    let removed = 0;
    let failed = 0;

    for (
      const item of
      last.created
    ) {

      const channel =
        message.guild.channels.cache.get(
          item.id
        );

      if (!channel) {
        continue;
      }

      try {

        await channel.delete(
          "AI undo"
        );

        removed++;

        await new Promise(
          r => setTimeout(r, 350)
        );

      } catch {

        failed++;

      }

    }

    return message.reply(
      `↩️ Undo complete.\n\nRemoved created objects: **${removed}**\nFailed: **${failed}**`
    );

  }

  // ==================================================
  // UNDO DELETE
  // ==================================================

  if (
    last.type === "delete"
  ) {

    let restored = 0;
    let failed = 0;

    for (
      const backup of
      last.backups
    ) {

      try {

        const options = {

          name:
            backup.name,

          type:
            backup.type,

          reason:
        
