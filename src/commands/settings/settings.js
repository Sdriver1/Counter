const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const prisma = require("../../../prisma/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counter-setting")
    .setDescription("Manage counter settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mode")
        .setDescription("Change the counting mode")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The counter channel to modify")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("new-mode")
            .setDescription("The new counting mode")
            .setRequired(true)
            .addChoices(
              { name: "Normal", value: "normal" },
              { name: "Fibonacci", value: "fibonacci" },
              { name: "Prime Numbers", value: "prime" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("slowmode")
        .setDescription("Set slowmode for the counting channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The counter channel to modify")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("seconds")
            .setDescription("Slowmode duration in seconds (0 to disable)")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(21600)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("blacklist")
        .setDescription("Blacklist a user from counting")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The counter channel to modify")
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to blacklist")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unblacklist")
        .setDescription("Remove a user from the blacklist")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The counter channel to modify")
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to unblacklist")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("whitelist")
        .setDescription("Whitelist a user (only whitelisted users can count)")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The counter channel to modify")
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to whitelist")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unwhitelist")
        .setDescription("Remove a user from the whitelist")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The counter channel to modify")
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to unwhitelist")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription("Reset the counter to 0")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The counter channel to reset")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
      const selectedChannel = interaction.options.getChannel("channel");

      const counter = await prisma.counter.findFirst({
        where: { 
          guildId,
          channelId: selectedChannel.id
        },
      });

      if (!counter) {
        return interaction.reply({
          content:
            `❌ No counter has been set up in ${selectedChannel}. Use \`/setup-counter\` first.`,
          ephemeral: true,
        });
      }

      switch (subcommand) {
        case "mode":
          await handleModeChange(interaction, counter);
          break;
        case "slowmode":
          await handleSlowmode(interaction, counter);
          break;
        case "blacklist":
          await handleBlacklist(interaction, counter, true);
          break;
        case "unblacklist":
          await handleBlacklist(interaction, counter, false);
          break;
        case "whitelist":
          await handleWhitelist(interaction, counter, true);
          break;
        case "unwhitelist":
          await handleWhitelist(interaction, counter, false);
          break;
        case "reset":
          await handleReset(interaction, counter);
          break;
      }
    } catch (error) {
      console.error("Error in counter-setting:", error);
      await interaction.reply({
        content: "❌ An error occurred while updating settings.",
        ephemeral: true,
      });
    }
  },
};

async function handleModeChange(interaction, counter) {
  const newMode = interaction.options.getString("new-mode");

  await prisma.counter.update({
    where: { id: counter.id },
    data: {
      mode: newMode,
      currentNumber: 0,
      position: 0,
      lastUserId: null,
    },
  });

  const channel = await interaction.guild.channels.fetch(counter.channelId);
  await channel.send(
    `⚙️ **Counter mode changed to ${newMode}!** The counter has been reset. Start counting from the beginning!`
  );

  await interaction.reply({
    content: `✅ Counter mode changed to **${newMode}** and counter reset!`,
    ephemeral: true,
  });
}

async function handleSlowmode(interaction, counter) {
  const seconds = interaction.options.getInteger("seconds");
  const channel = await interaction.guild.channels.fetch(counter.channelId);

  await channel.setRateLimitPerUser(seconds);

  await interaction.reply({
    content:
      seconds === 0
        ? "✅ Slowmode disabled for the counting channel."
        : `✅ Slowmode set to **${seconds} seconds** for the counting channel.`,
    ephemeral: true,
  });
}

async function handleBlacklist(interaction, counter, add) {
  const user = interaction.options.getUser("user");
  const blacklist = JSON.parse(counter.blacklistedUsers || "[]");

  if (add) {
    if (blacklist.includes(user.id)) {
      return interaction.reply({
        content: `❌ ${user.tag} is already blacklisted.`,
        ephemeral: true,
      });
    }
    blacklist.push(user.id);
  } else {
    const index = blacklist.indexOf(user.id);
    if (index === -1) {
      return interaction.reply({
        content: `❌ ${user.tag} is not in the blacklist.`,
        ephemeral: true,
      });
    }
    blacklist.splice(index, 1);
  }

  await prisma.counter.update({
    where: { id: counter.id },
    data: { blacklistedUsers: JSON.stringify(blacklist) },
  });

  await interaction.reply({
    content: add
      ? `✅ ${user.tag} has been blacklisted from counting.`
      : `✅ ${user.tag} has been removed from the blacklist.`,
    ephemeral: true,
  });
}

async function handleWhitelist(interaction, counter, add) {
  const user = interaction.options.getUser("user");
  const whitelist = JSON.parse(counter.whitelistedUsers || "[]");

  if (add) {
    if (whitelist.includes(user.id)) {
      return interaction.reply({
        content: `❌ ${user.tag} is already whitelisted.`,
        ephemeral: true,
      });
    }
    whitelist.push(user.id);
  } else {
    const index = whitelist.indexOf(user.id);
    if (index === -1) {
      return interaction.reply({
        content: `❌ ${user.tag} is not in the whitelist.`,
        ephemeral: true,
      });
    }
    whitelist.splice(index, 1);
  }

  await prisma.counter.update({
    where: { id: counter.id },
    data: { whitelistedUsers: JSON.stringify(whitelist) },
  });

  await interaction.reply({
    content: add
      ? `✅ ${user.tag} has been whitelisted. ${whitelist.length > 0 ? "Only whitelisted users can count now." : ""}`
      : `✅ ${user.tag} has been removed from the whitelist.`,
    ephemeral: true,
  });
}

async function handleReset(interaction, counter) {
  await prisma.counter.update({
    where: { id: counter.id },
    data: {
      currentNumber: 0,
      position: 0,
      lastUserId: null,
    },
  });

  const channel = await interaction.guild.channels.fetch(counter.channelId);
  await channel.send("🔄 **Counter has been reset!** Start counting from 1!");

  await interaction.reply({
    content: "✅ Counter has been reset to 0!",
    ephemeral: true,
  });
}
