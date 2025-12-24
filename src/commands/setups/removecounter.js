const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../../prisma/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove-counter")
    .setDescription("Remove a counting channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The counter channel to remove")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const selectedChannel = interaction.options.getChannel("channel");
      const channelId = selectedChannel.id;

      const counters = await prisma.counter.findMany({
        where: {
          guildId,
          channelId,
        },
      });

      if (counters.length === 0) {
        await interaction.reply({
          content: `❌ No counter is set up in ${selectedChannel}.`,
          ephemeral: true,
        });
        return;
      }

      await prisma.counter.deleteMany({
        where: {
          guildId,
          channelId,
        },
      });

      await interaction.reply({
        content: `✅ ${counters.length > 1 ? `${counters.length} counters` : 'Counter'} removed from ${selectedChannel}! The channel can now be used normally.`,
        ephemeral: true,
      });

      await selectedChannel.send(
        "**This channel is no longer a counting channel.**"
      );
    } catch (error) {
      console.error("Error removing counter:", error);
      await interaction.reply({
        content: "❌ An error occurred while removing the counter.",
        ephemeral: true,
      });
    }
  },
};
