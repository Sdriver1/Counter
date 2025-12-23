const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../../prisma/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-counter')
        .setDescription('Setup a counting channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;
            const existingCounter = await prisma.counter.findUnique({
                where: { guildId }
            });

            if (existingCounter) {
                await prisma.counter.update({
                    where: { guildId },
                    data: {
                        channelId,
                        currentNumber: 0,
                        lastUserId: null
                    }
                });

                await interaction.reply({
                    content: `✅ Counter updated! This channel is now the counting channel. Start counting from **1**!`,
                    ephemeral: true
                });
            } else {
                await prisma.counter.create({
                    data: {
                        guildId,
                        channelId,
                        currentNumber: 0
                    }
                });

                await interaction.reply({
                    content: `✅ Counter setup complete! This channel is now the counting channel. Start counting from **1**!\n\n📝 You can use math expressions like:\n• Simple: \`1\`, \`2\`, \`3\`\n• Addition: \`1+1\` for 2\n• Power: \`2^2\` for 4\n• Complex: \`(5*2)+1\` for 11`,
                    ephemeral: true
                });
            }

            await interaction.channel.send('**Counting starts now! Begin with 1**');
        } catch (error) {
            console.error('Error setting up counter:', error);
            await interaction.reply({
                content: 'An error occurred while setting up the counter.',
                ephemeral: true
            });
        }
    }
};
