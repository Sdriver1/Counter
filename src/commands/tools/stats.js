const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const prisma = require('../../../prisma/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View counting statistics for this server')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The counter channel to view stats for (optional)')
                .setRequired(false)
        )
        .addIntegerOption((option) =>
            option
                .setName('page')
                .setDescription('Leaderboard page number (default: 1)')
                .setRequired(false)
                .setMinValue(1)
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

            const PAGE_SIZE = 10;
            const page = interaction.options.getInteger('page') ?? 1;
            const skip = (page - 1) * PAGE_SIZE;

            const [totalCounts, topCounters, allCounters] = await Promise.all([
                prisma.countHistory.count({ where: { guildId } }),
                prisma.countHistory.groupBy({
                    by: ['userId'],
                    where: { guildId },
                    _count: { userId: true },
                    orderBy: { _count: { userId: 'desc' } },
                    take: PAGE_SIZE,
                    skip,
                }),
                prisma.countHistory.groupBy({
                    by: ['userId'],
                    where: { guildId },
                    _count: { userId: true },
                }).then(r => r.length),
            ]);

            const totalPages = Math.max(1, Math.ceil(allCounters / PAGE_SIZE));

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
                    value: [
                        `<#${counter.channelId}>`,
                        `Current: **${counter.currentNumber}**`,
                        `Streak: **${counter.streak}** (Best: ${counter.highestStreak})`
                    ].join(' • '),
                    inline: false
                });
            }

            if (topCounters.length > 0) {
                const leaderboard = topCounters.map((entry, index) => {
                    const rank = skip + index + 1;
                    const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
                    return `${emoji} **#${rank}** <@${entry.userId}> — ${entry._count.userId} counts`;
                }).join('\n');

                embed.addFields({ name: `🏆 Top Counters (Page ${page}/${totalPages})`, value: leaderboard });
            } else {
                embed.addFields({ name: '🏆 Top Counters', value: 'No counts yet on this page.' });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error({ err: error }, 'Error fetching stats');
            await interaction.reply({
                content: '❌ An error occurred while fetching statistics.',
                ephemeral: true
            });
        }
    }
};
