const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

// ======================================================
// Helpers
// ======================================================

function getTargetChannels(guild) {
  return [...guild.channels.cache.values()].filter(channel => {
    // NEVER include categories when target is channel
    return (
      channel.type !== ChannelType.GuildCategory &&
      typeof channel.setName === "function" &&
      channel.name
    );
  });
}

function getTargetCategories(guild) {
  return [...guild.channels.cache.values()].filter(channel => {
    return (
      channel.type === ChannelType.GuildCategory &&
      typeof channel.setName === "function" &&
      channel.name
    );
  });
}

// Remove decorative styling while keeping the meaningful name.
function makeSimpleName(name) {
  let result = name;

  // Remove emojis
  result = result.replace(
    /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}]/gu,
    ""
  );

  // Remove common decorative characters from beginning/end
  result = result.replace(
    /^[\s\-_+=|•●○◆◇★☆✦✧✿❖「」『』【】〔〕《》〈〉╭╮╯╰┌┐└┘┃│║]+/u,
    ""
  );

  result = result.replace(
    /[\s\-_+=|•●○◆◇★☆✦✧✿❖「」『』【】〔〕《》〈〉╭╮╯╰┌┐└┘┃│║]+$/u,
    ""
  );

  result = result.trim();

  if (!result) {
    result = "channel";
  }

  return result.slice(0, 100);
}

// ======================================================
// Calculate new name
// ======================================================

function getNewName(channel, action) {
  switch (action.mode) {

    // ------------------------------------------
    // REPLACE
    // ------------------------------------------
    case "replace":
      return String(action.name || "")
        .trim()
        .slice(0, 100);

    // ------------------------------------------
    // PREFIX
    // ------------------------------------------
    case "prefix": {
      const prefix = String(action.prefix || "");
      const separator = action.space_after_prefix ? " " : "";

      return `${prefix}${separator}${channel.name}`
        .slice(0, 100);
    }

    // ------------------------------------------
    // SUFFIX
    // ------------------------------------------
    case "suffix":
      return `${channel.name}${action.suffix || ""}`
        .slice(0, 100);

    // ------------------------------------------
    // SIMPLE
    // ------------------------------------------
    case "simple":
      return makeSimpleName(channel.name);

    default:
      return null;
  }
}

// ======================================================
// Execute rename
// ======================================================

async function executeChannelRename(message, action) {

  // ==================================================
  // Permission check - USER
  // ==================================================

  if (
    !message.member.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return message.reply({
      content: "❌ You need **Manage Channels** permission.",
      allowedMentions: {
        repliedUser: false
      }
    });
  }

  // ==================================================
  // Permission check - BOT
  // ==================================================

  const botMember = message.guild.members.me;

  if (
    !botMember ||
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return message.reply({
      content: "❌ I need **Manage Channels** permission.",
      allowedMentions: {
        repliedUser: false
      }
    });
  }

  // ==================================================
  // Validate action
  // ==================================================

  if (!action) {
    return message.reply({
      content: "❌ No rename action was provided.",
      allowedMentions: {
        repliedUser: false
      }
    });
  }

  const target = action.target || "channel";
  const mode = action.mode || "prefix";

  console.log("========================================");
  console.log("🔄 CHANNEL RENAME REQUEST");
  console.log("Target:", target);
  console.log("Mode:", mode);
  console.log("Action:", JSON.stringify(action, null, 2));
  console.log("========================================");

  // ==================================================
  // GET TARGETS
  // ==================================================

  let changeable = [];
  let skipped = [];

  // --------------------------------------------------
  // CHANNELS ONLY
  // --------------------------------------------------

  if (target === "channel") {

    changeable = getTargetChannels(
      message.guild
    );

  }

  // --------------------------------------------------
  // CATEGORIES ONLY
  // --------------------------------------------------

  else if (target === "category") {

    changeable = getTargetCategories(
      message.guild
    );

  }

  // --------------------------------------------------
  // INVALID TARGET
  // --------------------------------------------------

  else {

    return message.reply({
      content:
        "❌ Invalid target. Use `channel` or `category`.",
      allowedMentions: {
        repliedUser: false
      }
    });

  }

  // ==================================================
  // CURRENT SCOPE
  // ==================================================

  if (action.scope === "current") {

    let current = null;

    if (target === "channel") {

      if (
        message.channel.type ===
        ChannelType.GuildCategory
      ) {

        return message.reply({
          content:
            "❌ The current object is a category, not a channel.",
          allowedMentions: {
            repliedUser: false
          }
        });

      }

      current = message.channel;

    } else if (target === "category") {

      if (
        message.channel.type ===
        ChannelType.GuildCategory
      ) {

        current = message.channel;

      } else if (message.channel.parent) {

        current = message.channel.parent;

      }

    }

    if (!current) {

      return message.reply({
        content:
          "❌ I couldn't find the requested current object.",
        allowedMentions: {
          repliedUser: false
        }
      });

    }

    changeable = [current];
  }

  // ==================================================
  // NAMED SCOPE
  // ==================================================

  if (
    action.scope === "named" &&
    action.oldName
  ) {

    const wanted = action.oldName
      .toLowerCase()
      .trim();

    const found = changeable.find(
      channel =>
        channel.name.toLowerCase() === wanted
    );

    if (!found) {

      return message.reply({
        content:
          `❌ I couldn't find ${target} **${action.oldName}**.`,
        allowedMentions: {
          repliedUser: false
        }
      });

    }

    changeable = [found];
  }

  // ==================================================
  // SPECIFIC MODE
  // ==================================================

  if (mode === "specific") {

    if (!action.name) {

      return message.reply({
        content:
          "❌ No new name was provided.",
        allowedMentions: {
          repliedUser: false
        }
      });

    }

    mode = "replace";
  }

  // ==================================================
  // REMOVE UNMANAGEABLE CHANNELS
  // ==================================================

  const manageable = [];

  for (const channel of changeable) {

    if (!channel.manageable) {

      skipped.push(channel);
      continue;

    }

    manageable.push(channel);
  }

  changeable = manageable;

  // ==================================================
  // NOTHING TO CHANGE
  // ==================================================

  if (changeable.length === 0) {

    return message.reply({
      content:
        "ℹ️ I couldn't find any manageable channels/categories that need changing.",
      allowedMentions: {
        repliedUser: false
      }
    });

  }

  // ==================================================
  // PREVIEW
  // ==================================================

  let preview = "";

  for (
    const channel of changeable.slice(0, 25)
  ) {

    let newName;

    if (mode === "replace") {

      newName = String(
        action.name || ""
      )
        .trim()
        .slice(0, 100);

    } else {

      newName = getNewName(
        channel,
        {
          ...action,
          mode
        }
      );

    }

    if (!newName) {
      newName = channel.name;
    }

    preview +=
      `\`${channel.name}\` → \`${newName}\`\n`;
  }

  if (changeable.length > 25) {

    preview +=
      `\n…and ${
        changeable.length - 25
      } more.`;

  }

  // ==================================================
  // PREVIEW DESCRIPTION
  // ==================================================

  let modeText = mode;

  if (mode === "replace") {
    modeText =
      `Replace with: **${action.name}**`;
  }

  if (mode === "prefix") {
    modeText =
      `Prefix: **${action.prefix || ""}**`;
  }

  if (mode === "suffix") {
    modeText =
      `Suffix: **${action.suffix || ""}**`;
  }

  if (mode === "simple") {
    modeText =
      "Remove decorative styling";
  }

  const embed = new EmbedBuilder()
    .setTitle("🔄 Here's what I understood")
    .setDescription(
      `**Action:** Rename ${target}s\n` +
      `**${target}s:** ${changeable.length}\n` +
      `**Mode:** ${modeText}\n\n` +
      preview
    )
    .setFooter({
      text:
        "Nothing will change until you press Agree."
    });

  // ==================================================
  // BUTTONS
  // ==================================================

  const buttons =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `channel_rename_agree_${message.author.id}`
          )
          .setLabel("Agree")
          .setEmoji("✅")
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            `channel_rename_cancel_${message.author.id}`
          )
          .setLabel("Cancel")
          .setEmoji("❌")
          .setStyle(
            ButtonStyle.Danger
          )

      );

  const reply =
    await message.reply({

      embeds: [embed],

      components: [buttons],

      allowedMentions: {
        repliedUser: false
      }

    });

  // ==================================================
  // CONFIRMATION COLLECTOR
  // ==================================================

  const collector =
    reply.createMessageComponentCollector({
      time: 60_000
    });

  collector.on(
    "collect",
    async interaction => {

      // ----------------------------------------------
      // ONLY ORIGINAL USER
      // ----------------------------------------------

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

      // ==================================================
      // CANCEL
      // ==================================================

      if (
        interaction.customId ===
        `channel_rename_cancel_${message.author.id}`
      ) {

        await interaction.deferUpdate();

        collector.stop("cancelled");

        await reply.edit({

          content:
            "❌ Cancelled. Nothing was changed.",

          embeds: [],

          components: []

        });

        return;
      }

      // ==================================================
      // AGREE
      // ==================================================

      if (
        interaction.customId ===
        `channel_rename_agree_${message.author.id}`
      ) {

        await interaction.deferUpdate();

        await reply.edit({

          content:
            "⏳ I'm changing the names now...",

          embeds: [],

          components: []

        });

        let changed = 0;
        let failed = 0;

        // ----------------------------------------------
        // ACTUAL RENAME
        // ----------------------------------------------

        for (
          const channel of changeable
        ) {

          try {

            let newName;

            // ------------------------------------------
            // REPLACE
            // ------------------------------------------

            if (
              mode === "replace"
            ) {

              newName =
                String(
                  action.name || ""
                )
                  .trim()
                  .slice(0, 100);

            }

            // ------------------------------------------
            // PREFIX / SUFFIX / SIMPLE
            // ------------------------------------------

            else {

              newName =
                getNewName(
                  channel,
                  {
                    ...action,
                    mode
                  }
                );

            }

            if (
              !newName ||
              newName === channel.name
            ) {

              skipped.push(channel);
              continue;

            }

            const oldName =
              channel.name;

            await channel.setName(
              newName,
              "AI channel management"
            );

            changed++;

            console.log(
              `✅ Renamed: ${oldName} → ${newName}`
            );

            // Small delay
            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  350
                )
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

        // ==================================================
        // RESULT
        // ==================================================

        const result =
          new EmbedBuilder()
            .setTitle(
              "✅ Rename Complete"
            )
            .setDescription(
              `Successfully processed the rename request.`
            )
            .addFields(

              {
                name: "Target",
                value: target,
                inline: true
              },

              {
                name: "Mode",
                value: mode,
                inline: true
              },

              {
                name: "Changed",
                value: String(changed),
                inline: true
              },

              {
                name: "Failed",
                value: String(failed),
                inline: true
              },

              {
                name: "Skipped",
                value: String(skipped.length),
                inline: true
              }

            );

        await reply.edit({

          content: "",

          embeds: [result],

          components: []

        });

      }

    }
  );

  // ==================================================
  // EXPIRED
  // ==================================================

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

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  executeChannelRename
};
