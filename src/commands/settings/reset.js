const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../../prisma/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reset-counter")
    .setDescription("Reset the counter to 0")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;

      const counter = await prisma.counter.findUnique({
        where: { guildId },
      });

      if (!counter) {
        await interaction.reply({
          content: "No counter has been set up in this server yet!",
          ephemeral: true,
        });
        return;
      }

      await prisma.counter.update({
        where: { guildId },
        data: {
          currentNumber: 0,
          lastUserId: null,
        },
      });

      await interaction.reply({
        content: "Counter has been reset to 0!",
        ephemeral: true,
      });

      const channel = await interaction.guild.channels.fetch(counter.channelId);
      if (channel) {
        await channel.send("**Counter has been reset! Start counting from 1**");
      }
    } catch (error) {
      console.error("Error resetting counter:", error);
      await interaction.reply({
        content: "An error occurred while resetting the counter.",
        ephemeral: true,
      });
    }
  },
};
