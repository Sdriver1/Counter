const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const prisma = require('../../../prisma/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View counting statistics for this server')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The counter channel to view stats for (optional)')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const selectedChannel = interaction.options.getChannel('channel');

            let counters;
            if (selectedChannel) {
                const counter = await prisma.counter.findFirst({
                    where: { 
                        guildId,
                        channelId: selectedChannel.id
                    }
                });
                
                if (!counter) {
                    await interaction.reply({
                        content: `❌ No counter has been set up in ${selectedChannel}!`,
                        ephemeral: true
                    });
                    return;
                }
                counters = [counter];
            } else {
                counters = await prisma.counter.findMany({
                    where: { guildId }
                });

                if (counters.length === 0) {
                    await interaction.reply({
                        content: '❌ No counters have been set up in this server yet!',
                        ephemeral: true
                    });
                    return;
                }
            }

            const totalCounts = await prisma.countHistory.count({
                where: { guildId }
            });

            const topCounters = await prisma.countHistory.groupBy({
                by: ['userId'],
                where: { guildId },
                _count: { userId: true },
                orderBy: { _count: { userId: 'desc' } },
                take: 5
            });

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Counting Statistics')
                .addFields(
                    { name: 'Total Counts', value: totalCounts.toString(), inline: true },
                    { name: 'Active Counters', value: counters.length.toString(), inline: true }
                );

            for (const counter of counters) {
                embed.addFields({
                    name: `${counter.mode.charAt(0).toUpperCase() + counter.mode.slice(1)} Mode`,
                    value: `<#${counter.channelId}> - Current: ${counter.currentNumber}`,
                    inline: false
                });
            }

            if (topCounters.length > 0) {
                const leaderboard = topCounters.map((entry, index) => {
                    const emoji = ['🥇', '🥈', '🥉'][index] || '🏅';
                    return `${emoji} <@${entry.userId}> - ${entry._count.userId} counts`;
                }).join('\n');

                embed.addFields({ name: '🏆 Top Counters', value: leaderboard });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching stats:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching statistics.',
                ephemeral: true
            });
        }
    }
};
