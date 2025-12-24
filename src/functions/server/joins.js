const { EmbedBuilder } = require("discord.js");

module.exports = async (client, guild) => {
  const logChannelID = "1453210700775293012";
  const name = guild.name;
  const serverID = guild.id;
  const memberCount = guild.memberCount;
  const ownerID = guild.ownerId;

  const currentGuildCount = client.guilds.cache.size;
  const totalUserCount = client.guilds.cache.reduce(
    (acc, guild) => acc + guild.memberCount,
    0
  );

  const embed = new EmbedBuilder()
    .setTitle("👋 New Server Joined")
    .setFields(
      {
        name: "<:_:1112602480128299079> Server Info",
        value: `**Server Name:** **${name}** (\`${serverID}\`) \n**Server Owner:** <@${ownerID}> (\`${ownerID}\`) \n**Member Count:** \`${memberCount}\`\n**Server Creation:** <t:${Math.floor(
          guild.createdTimestamp / 1000
        )}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
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


