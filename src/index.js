require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const prisma = require("../prisma/database");

const ready = require("./functions/bot/ready");
const interactionCreate = require("./functions/bot/interactioncreate");

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

client.once("ready", () => ready(client));
client.on("interactionCreate", (interaction) =>
  interactionCreate(client, interaction)
);

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  try {
    const counter = await prisma.counter.findUnique({
      where: { guildId: message.guild.id },
    });

    if (!counter || counter.channelId !== message.channel.id) return;

    const modeName = counter.mode || "normal";
    let mode;
    try {
      mode = require(`./modes/${modeName}`);
    } catch (error) {
      console.error(`Failed to load mode ${modeName}, falling back to normal`);
      mode = require("./modes/normal");
    }

    const { isValid, value, expression } =
      require("./functions/counter/numberverifier").verifyNumber(
        message.content,
        counter.currentNumber
      );

    if (isValid && mode.validate(counter.currentNumber, value, counter.position)) {
      // Check if same user counted twice in a row
      if (counter.lastUserId === message.author.id) {
        await message.react("❌");
        await message.reply("❌ You cannot count twice in a row!");

        // Reset counter
        await prisma.counter.update({
          where: { guildId: message.guild.id },
          data: {
            currentNumber: 0,
            position: 0,
            lastUserId: null,
          },
        });
        return;
      }
      await prisma.counter.update({
        where: { guildId: message.guild.id },
        data: {
          currentNumber: value,
          position: counter.position + 1,
          lastUserId: message.author.id,
        },
      });

      await prisma.countHistory.create({
        data: {
          guildId: message.guild.id,
          userId: message.author.id,
          number: value,
          expression: expression,
        },
      });

      await message.react("✅");
    } else if (isValid) {
      await message.react("❌");
      const expected = mode.getExpectedDescription(counter.currentNumber);
      await message.reply(
        `❌ Wrong number! Expected ${expected}, but got ${value}`
      );
      await prisma.counter.update({
        where: { guildId: message.guild.id },
        data: {
          currentNumber: 0,
          position: 0,
          lastUserId: null,
        },
      });
    }
  } catch (error) {
    console.error("Error processing count:", error);
  }
});

client.login(process.env.DISCORD_TOKEN);
