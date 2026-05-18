const logger = require('../../utils/logger');

async function interactionCreate(client, interaction) {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      logger.error({ err: error }, 'Error handling autocomplete');
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error({ err: error }, 'Error executing command');
    await interaction.reply({
      content: "There was an error executing this command!",
      ephemeral: true,
    });
  }
}

module.exports = interactionCreate;
