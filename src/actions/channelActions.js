const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

async function executeChannelRename(message, action) {

  // -----------------------------
  // Permission check
  // -----------------------------

  if (
    !message.member.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return message.reply(
      "❌ You need **Manage Channels** permission."
    );
  }

  const botMember = message.guild.members.me;

  if (
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return message.reply(
      "❌ I need **Manage Channels** permission."
    );
  }

  // -----------------------------
  // Find channels
  // -----------------------------

  const channels = [
    ...message.guild.channels.cache.values()
  ];

  const changeable = [];
  const skipped = [];

  for (const channel of channels) {

    // Categories are excluded
    if (
      action.exclude_categories &&
      channel.type === ChannelType.GuildCategory
    ) {
      continue;
    }

    if (
      !channel.name ||
      typeof channel.setName !== "function"
    ) {
      continue;
    }

    // Already has requested prefix
    if (
      action.prefix &&
      channel.name.startsWith(action.prefix)
    ) {
      skipped.push(channel);
      continue;
    }

    if (!channel.manageable) {
      skipped.push(channel);
      continue;
    }

    changeable.push(channel);
  }

  if (changeable.length === 0) {
    return message.reply(
      "ℹ️ I couldn't find any channels that need changing."
    );
  }

  // -----------------------------
  // Create preview
  // -----------------------------

  const prefix = action.prefix || "";

  const separator =
    action.space_after_prefix ? " " : "";

  let preview = "";

  for (const channel of changeable.slice(0, 25)) {

    const newName =
      `${prefix}${separator}${channel.name}`;

    preview +=
      `\`${channel.name}\` → \`${newName}\`\n`;
  }

  if (changeable.length > 25) {
    preview +=
      `\n…and ${changeable.length - 25} more.`;
  }

  const embed = new EmbedBuilder()
    .setTitle("🔄 Here's what I understood")
    .setDescription(
      `**Action:** Rename channels\n` +
      `**Channels:** ${changeable.length}\n` +
      `**Prefix:** ${prefix || "None"}\n` +
      `**Space after prefix:** ${
        action.space_after_prefix ? "Yes" : "No"
      }\n\n` +
      preview
    )
    .setFooter({
      text: "Nothing will change until you press Agree."
    });

  const buttons = new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId(
          `agree_${message.author.id}`
        )
        .setLabel("Agree")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(
          `cancel_${message.author.id}`
        )
        .setLabel("Cancel")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    );

  const reply = await message.reply({
    embeds: [embed],
    components: [buttons]
  });

  // -----------------------------
  // Confirmation
  // -----------------------------

  const collector =
    reply.createMessageComponentCollector({
      time: 60_000
    });

  collector.on("collect", async (interaction) => {

    if (
      interaction.user.id !== message.author.id
    ) {
      return interaction.reply({
        content:
          "❌ Only the person who requested this can confirm it.",
        ephemeral: true
      });
    }

    // CANCEL
    if (
      interaction.customId ===
      `cancel_${message.author.id}`
    ) {

      collector.stop("cancelled");

      return interaction.update({
        content:
          "❌ Cancelled. Nothing was changed.",
        embeds: [],
        components: []
      });
    }

    // AGREE
    if (
      interaction.customId ===
      `agree_${message.author.id}`
    ) {

      await interaction.update({
        content:
          "⏳ I'm changing the channels now...",
        embeds: [],
        components: []
      });

      let changed = 0;
      let failed = 0;

      const prefix = action.prefix || "";

      const separator =
        action.space_after_prefix
          ? " "
          : "";

      for (const channel of changeable) {

        try {

          const newName =
            `${prefix}${separator}${channel.name}`;

          await channel.setName(newName);

          changed++;

        } catch (error) {

          failed++;

          console.error(
            `Failed to rename ${channel.name}:`,
            error.message
          );
        }
      }

      collector.stop("completed");

      const result = new EmbedBuilder()
        .setTitle("✅ Done")
        .setDescription(
          `I finished the channel rename.`
        )
        .addFields(
          {
            name: "Changed",
            value: `${changed}`,
            inline: true
          },
          {
            name: "Failed",
            value: `${failed}`,
            inline: true
          }
        );

      return interaction.editReply({
        content: "",
        embeds: [result],
        components: []
      });
    }
  });

  // -----------------------------
  // Confirmation timeout
  // -----------------------------

  collector.on("end", async (_, reason) => {

    if (reason === "time") {

      try {

        await reply.edit({
          content:
            "⌛ Confirmation expired. Nothing was changed.",
          embeds: [],
          components: []
        });

      } catch {}
    }
  });
}

module.exports = {
  executeChannelRename
};
