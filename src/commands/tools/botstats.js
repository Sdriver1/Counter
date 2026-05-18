const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const prisma = require("../../../prisma/database");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("botstats")
    .setDescription("View bot statistics across all servers"),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const client = interaction.client;
      const guildCount = client.guilds.cache.size;
      let totalUsers = 0;
      client.guilds.cache.forEach((guild) => {
        totalUsers += guild.memberCount;
      });
      const totalCounts = await prisma.countHistory.count();
      const activeCounters = await prisma.counter.count();

      // Get or create HighestCounts record
      let highestCounts = await prisma.highestCounts.findFirst();
      if (!highestCounts) {
        highestCounts = await prisma.highestCounts.create({
          data: { normal: 0, fibonacci: 0, prime: 0, even: 0, odd: 0, squares: 0 },
        });
      }

      const highestCount =
        "Normal: " + highestCounts.normal.toLocaleString() +
        "\nFibonacci: " + highestCounts.fibonacci.toLocaleString() +
        "\nPrime: " + highestCounts.prime.toLocaleString() +
        "\nEven: " + highestCounts.even.toLocaleString() +
        "\nOdd: " + highestCounts.odd.toLocaleString() +
        "\nSquares: " + highestCounts.squares.toLocaleString();

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🤖 Bot Statistics")
        .setDescription("Global statistics across all servers")
        .addFields(
          {
            name: "Guilds",
            value: guildCount.toLocaleString(),
            inline: true,
          },
          {
            name: "Total Users",
            value: totalUsers.toLocaleString(),
            inline: true,
          },
          {
            name: "Active Counters",
            value: activeCounters.toLocaleString(),
            inline: true,
          },
          {
            name: "Total Counts",
            value: totalCounts.toLocaleString(),
            inline: true,
          },
          {
            name: "Highest Count",
            value: highestCount.toLocaleString(),
            inline: true,
          },
          {
            name: "Uptime",
            value: formatUptime(client.uptime),
            inline: true,
          }
        )
        .setFooter({ text: "Advanced Counting Bot" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching bot stats');
      await interaction.editReply({
        content: "❌ An error occurred while fetching bot statistics.",
      });
    }
  },
};

function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(" ") : "Just started";
}
