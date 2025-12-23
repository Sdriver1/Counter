const { REST, Routes } = require('discord.js');

async function registerCommands(client) {
    const commands = [];
    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

module.exports = registerCommands;
