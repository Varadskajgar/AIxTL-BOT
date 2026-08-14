const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

// ======================================================
// SMALL-CAP / FANCY UNICODE → NORMAL LETTERS
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
  "x": "x",
  "ʏ": "y",
  "ᴢ": "z",

  "ᵃ": "a",
  "ᵇ": "b",
  "ᶜ": "c",
  "ᵈ": "d",
  "ᵉ": "e",
  "ᶠ": "f",
  "ᵍ": "g",
  "ʰ": "h",
  "ⁱ": "i",
  "ʲ": "j",
  "ᵏ": "k",
  "ˡ": "l",
  "ᵐ": "m",
  "ⁿ": "n",
  "ᵒ": "o",
  "ᵖ": "p",
  "ʳ": "r",
  "ˢ": "s",
  "ᵗ": "t",
  "ᵘ": "u",
  "ᵛ": "v",
  "ʷ": "w",
  "ˣ": "x",
  "ʸ": "y",
  "ᶻ": "z"
};

// ======================================================
// SIMPLE NAME
//
// "simple" = ONLY normal readable words
//
// Examples:
//
// 〢ᴏᴡᴏ              → owo
// 〢ᴀᴄʜɪᴠᴇᴍᴇɴᴛs    → achievements
// 🎮・ɢᴀᴍɪɴɢ ᴠᴄ    → gaming vc
// 「🔥」Rules        → rules
// ━━ GENERAL ━━     → general
//
// Numbers are also kept.
// ======================================================

function makeSimpleName(name) {

  let result = String(name || "");

  // ------------------------------------------
  // Convert fancy Unicode letters
  // ------------------------------------------

  result = result.replace(
    /[ᴀ-ᴢǫʀᵃ-ᶻ]/gu,
    char => fancyMap[char] || char
  );

  // ------------------------------------------
  // Lowercase
  // ------------------------------------------

  result = result.toLowerCase();

  // ------------------------------------------
  // Keep ONLY:
  //
  // a-z
  // 0-9
  // spaces
  //
  // Everything else is removed.
  // ------------------------------------------

  result = result.replace(
    /[^a-z0-9\s]/g,
    " "
  );

  // ------------------------------------------
  // Remove repeated spaces
  // ------------------------------------------

  result = result.replace(
    /\s+/g,
    " "
  );

  result = result.trim();

  // ------------------------------------------
  // Discord cannot have empty names
  // ------------------------------------------

  if (!result) {
    result = "channel";
  }

  // Discord max channel name length
  return result.slice(0, 100);
}

// ======================================================
// GET CHANNELS ONLY
// ======================================================

function getChannels(guild) {

  return [
    ...guild.channels.cache.values()
  ].filter(channel => {

    return (
      channel.type !== ChannelType.GuildCategory &&
      typeof channel.setName === "function" &&
      channel.name
    );

  });
}

// ======================================================
// GET CATEGORIES ONLY
// ======================================================

function getCategories(guild) {

  return [
    ...guild.channels.cache.values()
  ].filter(channel => {

    return (
      channel.type === ChannelType.GuildCategory &&
      typeof channel.setName === "function" &&
      channel.name
    );

  });
}

// ======================================================
// CALCULATE NEW NAME
// ======================================================

function getNewName(channel, action) {

  switch (action.mode) {

    // ------------------------------------------
    // REPLACE
    // ------------------------------------------

    case "replace":

      return String(
        action.name || ""
      )
        .trim()
        .slice(0, 100);

    // ------------------------------------------
    // PREFIX
    // ------------------------------------------

    case "prefix": {

      const prefix =
        String(action.prefix || "");

      const separator =
        action.space_after_prefix
          ? " "
          : "";

      return (
        prefix +
        separator +
        channel.name
      ).slice(0, 100);
    }

    // ------------------------------------------
    // SUFFIX
    // ------------------------------------------

    case "suffix":

      return (
        channel.name +
        String(action.suffix || "")
      ).slice(0, 100);

    // ------------------------------------------
    // SIMPLE
    // ------------------------------------------

    case "simple":

      return makeSimpleName(
        channel.name
      );

    default:

      return null;
  }
}

// ======================================================
// EXECUTE CHANNEL RENAME
// ======================================================

async function executeChannelRename(
  message,
  action
) {

  // ==================================================
  // USER PERMISSION
  // ==================================================

  if (
    !message.member.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {

    return message.reply({

      content:
        "❌ You need **Manage Channels** permission.",

      allowedMentions: {
        repliedUser: false
      }

    });

  }

  // ==================================================
  // BOT PERMISSION
  // ==================================================

  const botMember =
    message.guild.members.me;

  if (
    !botMember ||
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {

    return message.reply({

      content:
        "❌ I need **Manage Channels** permission.",

      allowedMentions: {
        repliedUser: false
      }

    });

  }

  // ==================================================
  // CHECK ACTION
  // ==================================================

  if (!action) {

    return message.reply({

      content:
        "❌ No rename action was provided.",

      allowedMentions: {
        repliedUser: false
      }

    });

  }

  console.log(
    "========================================"
  );

  console.log(
    "🔄 RENAME REQUEST"
  );

  console.log(
    JSON.stringify(
      action,
      null,
      2
    )
  );

  console.log(
    "========================================"
  );

  // ==================================================
  // TARGET
  // ==================================================

  const target =
    action.target || "channel";

  let changeable = [];
  let skipped = [];

  // ==================================================
  // CHANNEL
  // ==================================================

  if (
    target === "channel"
  ) {

    changeable =
      getChannels(
        message.guild
      );

  }

  // ==================================================
  // CATEGORY
  // ==================================================

  else if (
    target === "category"
  ) {

    changeable =
      getCategories(
        message.guild
      );

  }

  else {

    return message.reply({

      content:
        "❌ Target must be `channel` or `category`.",

      allowedMentions: {
        repliedUser: false
      }

    });

  }

  // ==================================================
  // CURRENT
  // ==================================================

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

        return message.reply({
          content:
            "❌ This is a category, not a channel.",
          allowedMentions: {
            repliedUser: false
          }
        });

      }

      changeable = [
        message.channel
      ];

    }

    else {

      let category = null;

      if (
        message.channel.type ===
        ChannelType.GuildCategory
      ) {

        category =
          message.channel;

      }

      else if (
        message.channel.parent
      ) {

        category =
          message.channel.parent;

      }

      if (!category) {

        return message.reply({
          content:
            "❌ No category found.",
          allowedMentions: {
            repliedUser: false
          }
        });

      }

      changeable = [
        category
      ];

    }

  }

  // ==================================================
  // SPECIFIC NAME
  // ==================================================

  if (
    action.scope === "named" &&
    action.oldName
  ) {

    const wanted =
      action.oldName
        .toLowerCase()
        .trim();

    const found =
      changeable.find(
        channel =>
          channel.name
            .toLowerCase()
            === wanted
      );

    if (!found) {

      return message.reply({

        content:
          `❌ ${target} **${action.oldName}** was not found.`,

        allowedMentions: {
          repliedUser: false
        }

      });

    }

    changeable = [
      found
    ];

  }

  // ==================================================
  // SPECIFIC MODE
  // ==================================================

  if (
    action.mode === "specific"
  ) {

    action.mode =
      "replace";

  }

  // ==================================================
  // CHECK MANAGEABLE
  // ==================================================

  const manageable = [];

  for (
    const channel of changeable
  ) {

    if (
      !channel.manageable
    ) {

      skipped.push(
        channel
      );

      continue;

    }

    manageable.push(
      channel
    );

  }

  changeable =
    manageable;

  // ==================================================
  // NOTHING
  // ==================================================

  if (
    changeable.length === 0
  ) {

    return message.reply({

      content:
        "ℹ️ There are no manageable objects to change.",

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
    const channel of
    changeable.slice(0, 25)
  ) {

    const newName =
      getNewName(
        channel,
        action
      );

    preview +=
      `\`${channel.name}\` → \`${newName}\`\n`;

  }

  if (
    changeable.length > 25
  ) {

    preview +=
      `\n…and ${
        changeable.length - 25
      } more.`;

  }

  // ==================================================
  // MODE DESCRIPTION
  // ==================================================

  let modeDescription =
    action.mode;

  if (
    action.mode === "replace"
  ) {

    modeDescription =
      `Replace with **${action.name}**`;

  }

  else if (
    action.mode === "prefix"
  ) {

    modeDescription =
      `Add prefix **${action.prefix}**`;

  }

  else if (
    action.mode === "suffix"
  ) {

    modeDescription =
      `Add suffix **${action.suffix}**`;

  }

  else if (
    action.mode === "simple"
  ) {

    modeDescription =
      "Remove everything except normal words and numbers";

  }

  // ==================================================
  // EMBED
  // ==================================================

  const embed =
    new EmbedBuilder()

      .setTitle(
        "🔄 Here's what I understood"
      )

      .setDescription(

        `**Action:** Rename ${target}s\n` +

        `**${target}s:** ${
          changeable.length
        }\n` +

        `**Mode:** ${
          modeDescription
        }\n\n` +

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

          .setLabel(
            "Agree"
          )

          .setEmoji(
            "✅"
          )

          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()

          .setCustomId(
            `channel_rename_cancel_${message.author.id}`
          )

          .setLabel(
            "Cancel"
          )

          .setEmoji(
            "❌"
          )

          .setStyle(
            ButtonStyle.Danger
          )

      );

  // ==================================================
  // SEND PREVIEW
  // ==================================================

  const reply =
    await message.reply({

      embeds: [
        embed
      ],

      components: [
        buttons
      ],

      allowedMentions: {
        repliedUser: false
      }

    });

  // ==================================================
  // BUTTON COLLECTOR
  // ==================================================

  const collector =
    reply.createMessageComponentCollector({

      time:
        60_000

    });

  // ==================================================
  // BUTTON CLICK
  // ==================================================

  collector.on(
    "collect",
    async interaction => {

      // ----------------------------------------------
      // WRONG USER
      // ----------------------------------------------

      if (
        interaction.user.id !==
        message.author.id
      ) {

        return interaction.reply({

          content:
            "❌ Only the person who requested this can confirm it.",

          ephemeral:
            true

        });

      }

      // ==================================================
      // CANCEL
      // ==================================================

      if (
        interaction.customId ===
        `channel_rename_cancel_${message.author.id}`
      ) {

        await interaction.deferUpdate();

        collector.stop(
          "cancelled"
        );

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
            "⏳ Changing names...",

          embeds: [],

          components: []

        });

        let changed = 0;
        let failed = 0;

        // ==================================================
        // ACTUAL RENAME
        // ==================================================

        for (
          const channel of
          changeable
        ) {

          try {

            const oldName =
              channel.name;

            const newName =
              getNewName(
                channel,
                action
              );

            // ------------------------------------------
            // Invalid
            // ------------------------------------------

            if (
              !newName
            ) {

              failed++;
              continue;

            }

            // ------------------------------------------
            // Already same
            // ------------------------------------------

            if (
              oldName ===
              newName
            ) {

              skipped.push(
                channel
              );

              continue;

            }

            // ------------------------------------------
            // SAVE OLD NAME
            //
            // This is useful for future UNDO support.
            // ------------------------------------------

            if (
              !global.channelRenameHistory
            ) {

              global.channelRenameHistory =
                new Map();

            }

            if (
              !global.channelRenameHistory.has(
                message.guild.id
              )
            ) {

              global.channelRenameHistory.set(
                message.guild.id,
                []
              );

            }

            global.channelRenameHistory
              .get(
                message.guild.id
              )
              .push({

                channelId:
                  channel.id,

                oldName:
                  oldName,

                newName:
                  newName,

                timestamp:
                  Date.now()

              });

            // ------------------------------------------
            // RENAME
            // ------------------------------------------

            await channel.setName(
              newName,
              "AI channel management"
            );

            changed++;

            console.log(
              `✅ ${oldName} → ${newName}`
            );

            // ------------------------------------------
            // Delay
            // ------------------------------------------

            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  350
                )
            );

          }

          catch (error) {

            failed++;

            console.error(
              `❌ Failed to rename ${channel.name}:`,
              error.message
            );

          }

        }

        collector.stop(
          "completed"
        );

        // ==================================================
        // RESULT
        // ==================================================

        const result =
          new EmbedBuilder()

            .setTitle(
              "✅ Rename Complete"
            )

            .setDescription(
              "The rename operation has finished."
            )

            .addFields(

              {
                name:
                  "Target",

                value:
                  target,

                inline:
                  true
              },

              {
                name:
                  "Mode",

                value:
                  action.mode,

                inline:
                  true
              },

              {
                name:
                  "Changed",

                value:
                  String(changed),

                inline:
                  true
              },

              {
                name:
                  "Failed",

                value:
                  String(failed),

                inline:
                  true
              },

              {
                name:
                  "Skipped",

                value:
                  String(skipped.length),

                inline:
                  true
              }

            );

        await reply.edit({

          content:
            "",

          embeds: [
            result
          ],

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

      if (
        reason !==
        "time"
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

      }

      catch {}

    }
  );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  executeChannelRename
};
