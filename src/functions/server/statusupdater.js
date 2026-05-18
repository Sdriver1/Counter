const prisma = require("../../../prisma/database");
const logger = require("../../utils/logger");

async function updateStatusChannels(client) {
  try {
    const guildCount = client.guilds.cache.size;
    let totalUsers = 0;
    client.guilds.cache.forEach((guild) => {
      totalUsers += guild.memberCount;
    });
    const activeCounters = await prisma.counter.count();

    await prisma.botStats.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', totalUsers },
      update: { totalUsers },
    });

    const GUILD_CHANNEL_ID = process.env.STATUS_GUILD_CHANNEL_ID;
    const USER_CHANNEL_ID = process.env.STATUS_USER_CHANNEL_ID;
    const COUNTER_CHANNEL_ID = process.env.STATUS_COUNTER_CHANNEL_ID;

    if (GUILD_CHANNEL_ID) {
      const guildChannel = await client.channels
        .fetch(GUILD_CHANNEL_ID)
        .catch(() => null);
      if (guildChannel) {
        await guildChannel
          .setName(`Guilds: ${guildCount.toLocaleString()}`)
          .catch((err) => logger.error({ err }, 'Failed to update status channel name'));
      }
    }

    if (USER_CHANNEL_ID) {
      const userChannel = await client.channels
        .fetch(USER_CHANNEL_ID)
        .catch(() => null);
      if (userChannel) {
        await userChannel
          .setName(`Users: ${totalUsers.toLocaleString()}`)
          .catch((err) => logger.error({ err }, 'Failed to update status channel name'));
      }
    }

    if (COUNTER_CHANNEL_ID) {
      const counterChannel = await client.channels
        .fetch(COUNTER_CHANNEL_ID)
        .catch(() => null);
      if (counterChannel) {
        await counterChannel
          .setName(`Active Counters: ${activeCounters.toLocaleString()}`)
          .catch((err) => logger.error({ err }, 'Failed to update status channel name'));
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Error updating status channels');
  }
}

function startStatusUpdater(client) {
  updateStatusChannels(client);

  setInterval(() => {
    updateStatusChannels(client);
  }, 15 * 60 * 1000);
}

module.exports = startStatusUpdater;
