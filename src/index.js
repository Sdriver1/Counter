require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

const ready = require("./functions/bot/ready");
const interactionCreate = require("./functions/bot/interactioncreate");
const joins = require("./functions/server/joins");
const leaves = require("./functions/server/leaves");
const startStatusUpdater = require("./functions/server/statusupdater");
const handleMessage = require("./functions/counter/messagehandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    }
  }
}

client.once("ready", () => {
  ready(client);
  startStatusUpdater(client);
});
client.on("interactionCreate", (interaction) =>
  interactionCreate(client, interaction)
);

client.on("guildCreate", (guild) => joins(client, guild));
client.on("guildDelete", (guild) => leaves(client, guild));

client.on("messageCreate", (message) => handleMessage(message));

client.login(process.env.DISCORD_TOKEN);
