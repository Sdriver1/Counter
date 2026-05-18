const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../../prisma/database");
const logger = require("../../utils/logger");
const { buildCounterEmbed } = require("../../utils/counterEmbed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-counter")
    .setDescription("Setup a counting channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("counting-mode")
        .setDescription("Pick the style of counting (default is normal)")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription(
          "The channel to set as the counting channel (default is current channel)"
        )
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const substring = focusedOption.value.toLowerCase();
    const modes = ["normal", "fibonacci", "prime", "even", "odd", "squares"];
    let choices = modes.filter((mode) =>
      mode.toLowerCase().startsWith(substring)
    );
    choices = choices.slice(0, 25);
    await interaction.respond(
      choices.map((choice) => ({
        name: choice,
        value: choice,
      }))
    );
  },

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const selectedChannel =
        interaction.options.getChannel("channel") || interaction.channel;
      const channelId = selectedChannel.id;
      const countingMode =
        interaction.options.getString("counting-mode") || "normal";
      const existingCounter = await prisma.counter.findUnique({
        where: {
          guildId_mode: {
            guildId,
            mode: countingMode
          }
        },
      });

      const embed = buildCounterEmbed(countingMode, 0, 0);
      const msg = await selectedChannel.send({ embeds: [embed] });
      await msg.pin().catch(() => null);

      if (existingCounter) {
        await prisma.counter.update({
          where: { guildId_mode: { guildId, mode: countingMode } },
          data: { channelId, currentNumber: 0, position: 0, lastUserId: null, lastUserTag: null, embedMessageId: msg.id },
        });

        await interaction.reply({
          content: `✅ Counter updated! ${selectedChannel} is now the counting channel using **${countingMode}** mode. Start counting from **1**!`,
          ephemeral: true,
        });
      } else {
        await prisma.counter.create({
          data: { guildId, channelId, mode: countingMode, currentNumber: 0, position: 0, embedMessageId: msg.id },
        });

        await interaction.reply({
          content: `✅ Counter setup complete! ${selectedChannel} is now the counting channel using **${countingMode}** mode. Start counting from **1**!`,
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Error setting up counter');
      await interaction.reply({
        content: "An error occurred while setting up the counter.",
        ephemeral: true,
      });
    }
  },
};
