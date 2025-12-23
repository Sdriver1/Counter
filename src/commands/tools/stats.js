const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const prisma = require('../../../prisma/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View counting statistics for this server'),
    
    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            const counter = await prisma.counter.findUnique({
                where: { guildId }
            });

            if (!counter) {
                await interaction.reply({
                    content: '❌ No counter has been set up in this server yet!',
                    ephemeral: true
                });
                return;
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
                    { name: 'Current Number', value: counter.currentNumber.toString(), inline: true },
                    { name: 'Total Counts', value: totalCounts.toString(), inline: true },
                    { name: 'Channel', value: `<#${counter.channelId}>`, inline: true }
                );

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
