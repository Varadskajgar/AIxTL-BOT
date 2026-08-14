const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

if (!global.aixHistory) global.aixHistory = new Map();

function getHistory(guildId) {
  if (!global.aixHistory.has(guildId)) global.aixHistory.set(guildId, []);
  return global.aixHistory.get(guildId);
}

function saveHistory(guildId, entry) {
  const history = getHistory(guildId);
  history.push(entry);
  if (history.length > 20) history.shift();
}

const fancyMap = {
  "ᴀ":"a","ʙ":"b","ᴄ":"c","ᴅ":"d","ᴇ":"e","ғ":"f","ɢ":"g","ʜ":"h",
  "ɪ":"i","ᴊ":"j","ᴋ":"k","ʟ":"l","ᴍ":"m","ɴ":"n","ᴏ":"o","ᴘ":"p",
  "ǫ":"q","ʀ":"r","s":"s","ᴛ":"t","ᴜ":"u","ᴠ":"v","ᴡ":"w","x":"x",
  "ʏ":"y","ᴢ":"z","ᶜ":"c","ᵈ":"d","ᵉ":"e","ᵍ":"g","ʰ":"h","ᶦ":"i",
  "ʲ":"j","ᵏ":"k","ˡ":"l","ᵐ":"m","ⁿ":"n","ᵒ":"o","ᵖ":"p","ʳ":"r",
  "ᵗ":"t","ᵘ":"u","ᵛ":"v","ʷ":"w","ˣ":"x","ʸ":"y"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkPermissions(message) {
  if (!message.guild) return "❌ This command can only be used inside a server.";

  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return "❌ You need **Manage Channels** permission.";
  }

  const botMember = message.guild.members.me;
  if (!botMember) return "❌ I couldn't find my server member.";

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return "❌ I need **Manage Channels** permission.";
  }

  return null;
}

function simpleName(name) {
  let result = [...String(name || "")]
    .map(c => fancyMap[c] || c)
    .join("")
    .toLowerCase();

  result = result.replace(/[^a-z0-9\s-]/g, " ");
  result = result.replace(/\s+/g, " ").trim();
  result = result.replace(/-+/g, "-");

  return (result || "channel").slice(0, 100);
}

function getTargets(guild, target) {
  return [...guild.channels.cache.values()].filter(channel =>
    target === "category"
      ? channel.type === ChannelType.GuildCategory
      : channel.type !== ChannelType.GuildCategory
  );
}

function calculateName(channel, action) {
  const mode = String(action.mode || "simple").toLowerCase();

  if (mode === "simple") return simpleName(channel.name);

  if (mode === "replace") {
    return simpleName(action.name || "channel");
  }

  if (mode === "prefix") {
    const prefix = String(action.prefix || "").trim();
    if (!prefix) return channel.name;

    const separator = action.space ? " " : "";
    const current = String(channel.name || "");

    // Do not add the same prefix twice if the command is repeated.
    if (current.startsWith(prefix + separator) || current === prefix) {
      return current.slice(0, 100);
    }

    // Discord channel names have a 100-character limit.
    const available = Math.max(1, 100 - prefix.length - separator.length);
    return `${prefix}${separator}${current}`.slice(0, prefix.length + separator.length + available);
  }

  return null;
}

async function confirmAction(message, title, description, callback) {
  const stamp = Date.now();
  const yesId = `aix_yes_${message.author.id}_${stamp}`;
  const noId = `aix_no_${message.author.id}_${stamp}`;

  const row = new ActionRowBuilder().addComponents(
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

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Nothing will happen until you press Agree." });

  const reply = await message.reply({
    embeds: [embed],
    components: [row],
    allowedMentions: { repliedUser: false }
  });

  const collector = reply.createMessageComponentCollector({ time: 60000 });

  collector.on("collect", async interaction => {
    if (interaction.user.id !== message.author.id) {
      return interaction.reply({
        content: "❌ Only the person who requested this can confirm it.",
        ephemeral: true
      }).catch(() => {});
    }

    if (interaction.customId === noId) {
      collector.stop("cancelled");
      await interaction.deferUpdate().catch(() => {});
      await reply.edit({
        content: "❌ Cancelled. Nothing was changed.",
        embeds: [],
        components: []
      }).catch(() => {});
      return;
    }

    if (interaction.customId !== yesId) return;

    await interaction.deferUpdate().catch(() => {});
    await reply.edit({
      content: "⏳ Working...",
      embeds: [],
      components: []
    }).catch(() => {});

    try {
      const result = await callback();
      collector.stop("completed");
      await reply.edit({
        content: result,
        embeds: [],
        components: []
      });
    } catch (error) {
      collector.stop("error");
      console.error("❌ Action error:", error);
      await reply.edit({
        content: `❌ Operation failed:\n\`\`\`\n${String(error.message || error).slice(0, 1800)}\n\`\`\``,
        embeds: [],
        components: []
      }).catch(() => {});
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "time") return;
    await reply.edit({
      content: "⌛ Confirmation expired. Nothing was changed.",
      embeds: [],
      components: []
    }).catch(() => {});
  });
}

async function executeRename(message, action) {
  const permissionError = checkPermissions(message);
  if (permissionError) return message.reply({ content: permissionError });

  const target = action.target === "category" ? "category" : "channel";
  let channels = getTargets(message.guild, target);

  if (action.scope === "current") {
    if (target === "channel") {
      if (message.channel.type === ChannelType.GuildCategory) {
        return message.reply("❌ This is a category, not a channel.");
      }
      channels = [message.channel];
    } else {
      const category = message.channel.type === ChannelType.GuildCategory
        ? message.channel
        : message.channel.parent;
      if (!category) return message.reply("❌ I couldn't find the current category.");
      channels = [category];
    }
  }

  if (action.scope === "named") {
    const wanted = String(action.oldName || action.name || "").toLowerCase().trim();
    const found = channels.find(c => c.name.toLowerCase() === wanted);
    if (!found) return message.reply(`❌ I couldn't find ${target} **${wanted}**.`);
    channels = [found];
  }

  const manageable = channels.filter(c => c.manageable);
  const skipped = channels.length - manageable.length;

  if (!manageable.length) {
    return message.reply("❌ I couldn't find any manageable targets.");
  }

  const preview = manageable.slice(0, 25).map(c => {
    const n = calculateName(c, action);
    return `\`${c.name}\` → \`${n || c.name}\``;
  }).join("\n");

  const extra = manageable.length > 25
    ? `\n…and ${manageable.length - 25} more.`
    : "";

  return confirmAction(
    message,
    "🔄 Rename Confirmation",
    `**Target:** ${target}\n**Count:** ${manageable.length}\n**Mode:** ${action.mode || "simple"}\n\n${preview}${extra}`,
    async () => {
      const changes = [];
      let changed = 0;
      let failed = 0;

      for (const channel of manageable) {
        const oldName = channel.name;
        const newName = calculateName(channel, action);

        if (!newName || newName === oldName) continue;

        try {
          await channel.setName(newName, "AI Discord management");
          changes.push({ channelId: channel.id, oldName, newName });
          changed++;
          await sleep(350);
        } catch (error) {
          failed++;
          console.error(`❌ Rename failed: ${oldName}`, error.message);
        }
      }

      if (changes.length) {
        saveHistory(message.guild.id, { type: "rename", changes });
      }

      return `✅ Rename complete.\n\nChanged: **${changed}**\nFailed: **${failed}**\nSkipped: **${skipped}**`;
    }
  );
}

async function executeCreate(message, action) {
  const permissionError = checkPermissions(message);
  if (permissionError) return message.reply({ content: permissionError });

  const target = action.target === "category" ? "category" : "channel";
  const count = Math.max(1, Math.min(Number(action.count) || 1, 100));

  let names = Array.isArray(action.names)
    ? action.names.map(n => simpleName(n)).filter(Boolean)
    : [];

  if (!names.length) names = ["new-channel"];

  let category = null;
  if (target === "channel" && action.category) {
    const wanted = String(action.category).toLowerCase().trim();
    category = message.guild.channels.cache.find(c =>
      c.type === ChannelType.GuildCategory &&
      c.name.toLowerCase() === wanted
    );
    if (!category) return message.reply(`❌ Category **${action.category}** was not found.`);
  }

  const preview = Array.from(
    { length: Math.min(count, 20) },
    (_, i) => `• \`${names[i % names.length]}\``
  ).join("\n");

  return confirmAction(
    message,
    "➕ Create Confirmation",
    `**Target:** ${target}\n**Count:** ${count}\n**Category:** ${category?.name || "None"}\n\n${preview}${count > 20 ? `\n…and ${count - 20} more.` : ""}`,
    async () => {
      const created = [];
      let failed = 0;

      for (let i = 0; i < count; i++) {
        const name = names[i % names.length];

        try {
          const channel = await message.guild.channels.create({
            name,
            type: target === "category" ? ChannelType.GuildCategory : ChannelType.GuildText,
            parent: target === "channel" ? category?.id || null : null,
            reason: "AI Discord management"
          });

          created.push({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parentId: channel.parentId || null
          });

          await sleep(350);
        } catch (error) {
          failed++;
          console.error(`❌ Create failed: ${name}`, error.message);
        }
      }

      if (created.length) saveHistory(message.guild.id, { type: "create", created });

      return `✅ Creation complete.\n\nCreated: **${created.length}**\nFailed: **${failed}**`;
    }
  );
}

async function executeDelete(message, action) {
  const permissionError = checkPermissions(message);
  if (permissionError) return message.reply({ content: permissionError });

  const target = action.target === "category" ? "category" : "channel";
  let channels = getTargets(message.guild, target);

  if (action.scope === "current") {
    if (target === "channel") {
      if (message.channel.type === ChannelType.GuildCategory) {
        return message.reply("❌ This is a category, not a channel.");
      }
      channels = [message.channel];
    } else {
      const category = message.channel.type === ChannelType.GuildCategory
        ? message.channel
        : message.channel.parent;
      if (!category) return message.reply("❌ I couldn't find the current category.");
      channels = [category];
    }
  }

  if (action.scope === "named") {
    const wanted = String(action.name || action.oldName || "").toLowerCase().trim();
    const found = channels.find(c => c.name.toLowerCase() === wanted);
    if (!found) return message.reply(`❌ I couldn't find ${target} **${wanted}**.`);
    channels = [found];
  }

  const manageable = channels.filter(c => c.manageable);
  const skipped = channels.length - manageable.length;
  if (!manageable.length) return message.reply("❌ I couldn't find anything I can delete.");

  const preview = manageable.slice(0, 25).map(c => `• \`${c.name}\``).join("\n");

  return confirmAction(
    message,
    "🗑️ Delete Confirmation",
    `**Target:** ${target}\n**Count:** ${manageable.length}\n\n${preview}${manageable.length > 25 ? `\n…and ${manageable.length - 25} more.` : ""}`,
    async () => {
      const backups = [];
      let deleted = 0;
      let failed = 0;

      for (const channel of manageable) {
        backups.push({
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId || null,
          topic: "topic" in channel ? channel.topic || null : null,
          nsfw: "nsfw" in channel ? Boolean(channel.nsfw) : false,
          rateLimitPerUser: "rateLimitPerUser" in channel
            ? Number(channel.rateLimitPerUser || 0)
            : 0
        });

        try {
          await channel.delete("AI Discord management");
          deleted++;
          await sleep(350);
        } catch (error) {
          failed++;
          console.error(`❌ Delete failed: ${channel.name}`, error.message);
        }
      }

      if (backups.length) saveHistory(message.guild.id, { type: "delete", backups });

      return `✅ Delete complete.\n\nDeleted: **${deleted}**\nFailed: **${failed}**\nSkipped: **${skipped}**`;
    }
  );
}

async function executeUndo(message) {
  const permissionError = checkPermissions(message);
  if (permissionError) return message.reply({ content: permissionError });

  const history = getHistory(message.guild.id);
  const entry = history.pop();

  if (!entry) return message.reply("❌ There is nothing to undo.");

  try {
    if (entry.type === "rename") {
      let restored = 0;
      for (const change of [...entry.changes].reverse()) {
        const channel = await message.guild.channels.fetch(change.channelId).catch(() => null);
        if (!channel?.manageable) continue;
        await channel.setName(change.oldName, "AI Discord undo");
        restored++;
        await sleep(350);
      }
      return `↩️ Undo complete. Restored **${restored}** channel name(s).`;
    }

    if (entry.type === "create") {
      let removed = 0;
      for (const item of [...entry.created].reverse()) {
        const channel = await message.guild.channels.fetch(item.id).catch(() => null);
        if (!channel?.manageable) continue;
        await channel.delete("AI Discord undo");
        removed++;
        await sleep(350);
      }
      return `↩️ Undo complete. Removed **${removed}** channel(s) that were created.`;
    }

    if (entry.type === "delete") {
      let recreated = 0;
      for (const backup of entry.backups) {
        let parent = null;
        if (backup.parentId) {
          parent = await message.guild.channels.fetch(backup.parentId).catch(() => null);
        }

        const options = {
          name: simpleName(backup.name),
          type: backup.type,
          parent: backup.type === ChannelType.GuildCategory ? null : parent?.id || null,
          reason: "AI Discord undo"
        };

        if (backup.topic && backup.type === ChannelType.GuildText) options.topic = backup.topic;
        if (backup.nsfw && backup.type === ChannelType.GuildText) options.nsfw = backup.nsfw;
        if (backup.rateLimitPerUser && backup.type === ChannelType.GuildText) {
          options.rateLimitPerUser = backup.rateLimitPerUser;
        }

        await message.guild.channels.create(options);
        recreated++;
        await sleep(350);
      }
      return `↩️ Undo complete. Recreated **${recreated}** channel(s).`;
    }

    history.push(entry);
    return "❌ I don't know how to undo that operation.";
  } catch (error) {
    history.push(entry);
    console.error("❌ Undo error:", error);
    return `❌ Undo failed: ${error.message}`;
  }
}

async function executeChannelRename(message, action) {
  return executeRename(message, action);
}

async function executeChannelAction(message, action) {
  switch (action.action) {
    case "rename":
    case "rename_channels":
      return executeRename(message, action);
    case "create":
      return executeCreate(message, action);
    case "delete":
      return executeDelete(message, action);
    case "undo":
      return executeUndo(message);
    default:
      return message.reply("❌ Unsupported channel action.");
  }
}

module.exports = {
  executeChannelRename,
  executeChannelAction,
  executeRename,
  executeCreate,
  executeDelete,
  executeUndo
};
