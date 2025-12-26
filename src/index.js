require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const prisma = require("../prisma/database");

const ready = require("./functions/bot/ready");
const interactionCreate = require("./functions/bot/interactioncreate");
const joins = require("./functions/server/joins");
const leaves = require("./functions/server/leaves");
const startStatusUpdater = require("./functions/server/statusupdater");

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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  try {
    const counter = await prisma.counter.findFirst({
      where: {
        guildId: message.guild.id,
        channelId: message.channel.id,
      },
    });

    if (!counter) return;

    const blacklist = JSON.parse(counter.blacklistedUsers || "[]");
    if (blacklist.includes(message.author.id)) {
      await message.react("🚫");
      return;
    }

    const whitelist = JSON.parse(counter.whitelistedUsers || "[]");
    if (whitelist.length > 0 && !whitelist.includes(message.author.id)) {
      await message.react("🚫");
      return;
    }

    const modeName = counter.mode || "normal";
    let mode;
    try {
      mode = require(`./modes/${modeName}`);
    } catch (error) {
      console.error(`Failed to load mode ${modeName}, falling back to normal`);
      mode = require("./modes/normal");
    }

    let isValid, value, expression;

    const expectedNext = mode.getNext(counter.currentNumber);

    if (mode.disableMath) {
      const parsed = parseInt(message.content.trim());
      if (isNaN(parsed)) {
        return;
      }
      isValid = true;
      value = parsed;
      expression = null;
    } else {
      const result = require("./functions/counter/numberverifier").verifyNumber(
        message.content,
        expectedNext
      );
      isValid = result.isValid;
      value = result.value;
      expression = result.expression;
    }

    if (
      isValid &&
      mode.validate(counter.currentNumber, value, counter.position)
    ) {
      if (counter.lastUserId === message.author.id) {
        await message.react("❌");
        await message.reply("❌ You cannot count twice in a row!");

        await prisma.counter.update({
          where: { id: counter.id },
          data: {
            currentNumber: 0,
            position: 0,
            lastUserId: null,
          },
        });
        return;
      }
      await prisma.counter.update({
        where: { id: counter.id },
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

      let highestCounts = await prisma.highestCounts.findFirst();
      if (!highestCounts) {
        highestCounts = await prisma.highestCounts.create({
          data: { normal: 0, fibonacci: 0, prime: 0 },
        });
      }

      const updateData = {};
      if (modeName === "normal" && value > highestCounts.normal) {
        updateData.normal = value;
      } else if (modeName === "fibonacci" && value > highestCounts.fibonacci) {
        updateData.fibonacci = value;
      } else if (modeName === "prime" && value > highestCounts.prime) {
        updateData.prime = value;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.highestCounts.update({
          where: { id: highestCounts.id },
          data: updateData,
        });
      }

      await message.react("✅");
    } else if (isValid) {
      await message.react("❌");
      const expected = mode.getExpectedDescription(counter.currentNumber);
      await message.reply(
        `❌ Wrong number! Expected ${expected}, but got ${value}`
      );
      await prisma.counter.update({
        where: { id: counter.id },
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
