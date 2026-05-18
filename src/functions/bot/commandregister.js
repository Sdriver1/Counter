const { REST, Routes } = require('discord.js');
const logger = require('../../utils/logger');

async function registerCommands(client) {
    const commands = [];
    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        logger.info('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        logger.info('Slash commands registered!');
    } catch (error) {
        logger.error({ err: error }, 'Error registering commands');
    }
}

module.exports = registerCommands;
