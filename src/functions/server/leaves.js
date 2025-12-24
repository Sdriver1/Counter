const { EmbedBuilder } = require("discord.js");

module.exports = async (client, guild) => {
  if (!guild.available) return;
  const logChannelID = "1453210700775293012";

  const name = guild.name || "undefined";
  const serverID = guild.id || "undefined";
  const memberCount = guild.memberCount || "undefined";
  const ownerID = guild.ownerId || "undefined";
  const currentGuildCount = client.guilds.cache.size;
  const totalUserCount = client.guilds.cache.reduce(
    (acc, guild) => acc + guild.memberCount,
    0
  );

  const embed = new EmbedBuilder()
    .setTitle(`❌ Left Server`)
    .addFields(
      {
        name: "<:_:1112602480128299079> Server Info",
        value: `**Server Name:** **${name}** (\`${serverID}\`)\n**Server Owner:** <@${ownerID}> (\`${ownerID}\`) \n**Member Count:** \`${memberCount}\` \n**Server Creation:** <t:${parseInt(
          guild.createdTimestamp / 1000
        )}:R> \n**Joined:** <t:${parseInt(
          guild.joinedTimestamp / 1000
        )}:F> (<t:${parseInt(guild.joinedTimestamp / 1000)}:R>)`,
      },
      {
        name: "<:_:1112602480128299079> Bot Info",
        value: `**Total # of guild:** \`${currentGuildCount}\` \n**Total user count**: \`${totalUserCount}\``,
      }
    )
    .setTimestamp()
    .setFooter({ text: `${serverID}` });

  const logChannel = await client.channels.fetch(logChannelID);
  if (logChannel) {
    logChannel.send({ embeds: [embed] });
  }
};
