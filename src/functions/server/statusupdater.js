const prisma = require("../../../prisma/database");

async function updateStatusChannels(client) {
  try {
    const guildCount = client.guilds.cache.size;
    let totalUsers = 0;
    client.guilds.cache.forEach((guild) => {
      totalUsers += guild.memberCount;
    });
    const activeCounters = await prisma.counter.count();

    const GUILD_CHANNEL_ID = "1453210699856740446";
    const USER_CHANNEL_ID = "1453210699856740447";
    const COUNTER_CHANNEL_ID = "1453210699856740449";

    if (GUILD_CHANNEL_ID) {
      const guildChannel = await client.channels
        .fetch(GUILD_CHANNEL_ID)
        .catch(() => null);
      if (guildChannel) {
        await guildChannel
          .setName(`Guilds: ${guildCount.toLocaleString()}`)
          .catch(console.error);
      }
    }

    if (USER_CHANNEL_ID) {
      const userChannel = await client.channels
        .fetch(USER_CHANNEL_ID)
        .catch(() => null);
      if (userChannel) {
        await userChannel
          .setName(`Users: ${totalUsers.toLocaleString()}`)
          .catch(console.error);
      }
    }

    if (COUNTER_CHANNEL_ID) {
      const counterChannel = await client.channels
        .fetch(COUNTER_CHANNEL_ID)
        .catch(() => null);
      if (counterChannel) {
        await counterChannel
          .setName(`Active Counters: ${activeCounters.toLocaleString()}`)
          .catch(console.error);
      }
    }
  } catch (error) {
    console.error("Error updating status channels:", error);
  }
}

function startStatusUpdater(client) {
  updateStatusChannels(client);

  setInterval(() => {
    updateStatusChannels(client);
  }, 15 * 60 * 1000);
}

module.exports = startStatusUpdater;
