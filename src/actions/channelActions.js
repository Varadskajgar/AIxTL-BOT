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
    return message.reply({
      content: "❌ You need **Manage Channels** permission.",
      allowedMentions: { repliedUser: false }
    });
  }

  const botMember = message.guild.members.me;

  if (
    !botMember ||
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return message.reply({
      content: "❌ I need **Manage Channels** permission.",
      allowedMentions: { repliedUser: false }
    });
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

    // Exclude categories if requested
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

    // Bot cannot manage this channel
    if (!channel.manageable) {
      skipped.push(channel);
      continue;
    }

    changeable.push(channel);
  }

  if (changeable.length === 0) {
    return message.reply({
      content:
        "ℹ️ I couldn't find any channels that need changing.",
      allowedMentions: { repliedUser: false }
    });
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

  // -----------------------------
  // Buttons
  // -----------------------------

  const buttons = new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId(
          `channel_rename_agree_${message.author.id}`
        )
        .setLabel("Agree")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(
          `channel_rename_cancel_${message.author.id}`
        )
        .setLabel("Cancel")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    );

  const reply = await message.reply({
    embeds: [embed],
    components: [buttons],
    allowedMentions: {
      repliedUser: false
    }
  });

  // -----------------------------
  // Confirmation collector
  // -----------------------------

  const collector =
    reply.createMessageComponentCollector({
      time: 60_000
    });

  collector.on("collect", async (interaction) => {

    console.log(
      `🔘 Button clicked: ${interaction.customId} by ${interaction.user.tag}`
    );

    // -----------------------------
    // Only original user
    // -----------------------------

    if (
      interaction.user.id !== message.author.id
    ) {
      try {
        await interaction.reply({
          content:
            "❌ Only the person who requested this can confirm it.",
          ephemeral: true
        });
      } catch (error) {
        console.error(
          "❌ Failed to reply to unauthorized interaction:",
          error
        );
      }

      return;
    }

    // -----------------------------
    // CANCEL
    // -----------------------------

    if (
      interaction.customId ===
      `channel_rename_cancel_${message.author.id}`
    ) {

      try {

        // Acknowledge immediately
        await interaction.deferUpdate();

        collector.stop("cancelled");

        await reply.edit({
          content:
            "❌ Cancelled. Nothing was changed.",
          embeds: [],
          components: []
        });

        console.log("❌ Channel rename cancelled.");

      } catch (error) {

        console.error(
          "❌ Cancel button error:",
          error
        );
      }

      return;
    }

    // -----------------------------
    // AGREE
    // -----------------------------

    if (
      interaction.customId ===
      `channel_rename_agree_${message.author.id}`
    ) {

      try {

        // IMPORTANT:
        // Acknowledge Discord immediately
        await interaction.deferUpdate();

        // Disable buttons immediately
        await reply.edit({
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

        // -----------------------------
        // Rename channels
        // -----------------------------

        for (const channel of changeable) {

          try {

            const newName =
              `${prefix}${separator}${channel.name}`;

            await channel.setName(newName);

            changed++;

            console.log(
              `✅ Renamed: ${channel.name} → ${newName}`
            );

          } catch (error) {

            failed++;

            console.error(
              `❌ Failed to rename ${channel.name}:`,
              error.message
            );
          }
        }

        collector.stop("completed");

        // -----------------------------
        // Result
        // -----------------------------

        const result = new EmbedBuilder()
          .setTitle("✅ Channel Rename Complete")
          .setDescription(
            "The channel rename operation has finished."
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
            },
            {
              name: "Skipped",
              value: `${skipped.length}`,
              inline: true
            }
          );

        await reply.edit({
          content: "",
          embeds: [result],
          components: []
        });

        console.log(
          `✅ Rename completed. Changed: ${changed}, Failed: ${failed}`
        );

      } catch (error) {

        console.error(
          "❌ Agree button error:",
          error
        );

        try {

          await reply.edit({
            content:
              "❌ Something went wrong while renaming the channels.",
            embeds: [],
            components: []
          });

        } catch (editError) {

          console.error(
            "❌ Could not update confirmation message:",
            editError
          );
        }
      }

      return;
    }
  });

  // -----------------------------
  // Collector error
  // -----------------------------

  collector.on("end", async (_, reason) => {

    console.log(
      `🔚 Button collector ended: ${reason}`
    );

    if (reason === "time") {

      try {

        await reply.edit({
          content:
            "⌛ Confirmation expired. Nothing was changed.",
          embeds: [],
          components: []
        });

      } catch (error) {

        console.error(
          "❌ Could not update expired confirmation:",
          error.message
        );
      }
    }
  });
}

module.exports = {
  executeChannelRename
};
