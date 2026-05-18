const prisma = require('../../../prisma/database');
const logger = require('../../utils/logger');
const { buildCounterEmbed } = require('../../utils/counterEmbed');

// tracks x^2 usage per user per counter for the current counting session
// key: `${counterId}:${userId}`, value: number of times used
const squaresFormatWarnings = new Map();

const SQUARES_SHORTHAND = /^\d+\s*\^\s*2$/;

function clearCounterStrikes(counterId) {
  for (const key of squaresFormatWarnings.keys()) {
    if (key.startsWith(`${counterId}:`)) squaresFormatWarnings.delete(key);
  }
}

async function updateEmbed(message, counter, currentNumber, streak, lastUserId) {
  if (!counter.embedMessageId) return;
  try {
    const embedMsg = await message.channel.messages.fetch(counter.embedMessageId);
    const embed = buildCounterEmbed(counter.mode || 'normal', currentNumber, streak, lastUserId);
    await embedMsg.edit({ embeds: [embed] });
  } catch {
    // embed message was deleted or inaccessible — silently ignore
  }
}

async function handleMessage(message) {
  if (message.author.bot) return;

  try {
    const counter = await prisma.counter.findFirst({
      where: {
        guildId: message.guild.id,
        channelId: message.channel.id,
      },
      include: {
        blacklistedUsers: true,
        whitelistedUsers: true,
      },
    });

    if (!counter) return;

    const isBlacklisted = counter.blacklistedUsers.some(b => b.userId === message.author.id);
    if (isBlacklisted) {
      await message.react('🚫');
      return;
    }

    if (counter.whitelistedUsers.length > 0) {
      const isWhitelisted = counter.whitelistedUsers.some(w => w.userId === message.author.id);
      if (!isWhitelisted) {
        await message.react('🚫');
        return;
      }
    }

    const modeName = counter.mode || 'normal';
    let mode;
    try {
      mode = require(`../../modes/${modeName}`);
    } catch (err) {
      logger.warn({ modeName }, 'Failed to load mode, falling back to normal');
      mode = require('../../modes/normal');
    }

    const expectedNext = mode.getNext(counter.currentNumber);
    let isValid, value, expression;

    if (mode.disableMath) {
      const parsed = parseInt(message.content.trim());
      if (isNaN(parsed)) return;
      isValid = true;
      value = parsed;
      expression = null;
    } else {
      const result = require('./numberverifier').verifyNumber(message.content, expectedNext);
      isValid = result.isValid;
      value = result.value;
      expression = result.expression;
    }

    if (isValid && mode.validate(counter.currentNumber, value, counter.position)) {
      if (counter.lastUserId === message.author.id) {
        await message.react('❌');
        await message.reply('❌ You cannot count twice in a row!');
        const brokenStreak = counter.streak;
        await prisma.counter.update({
          where: { id: counter.id },
          data: { currentNumber: 0, position: 0, lastUserId: null, lastUserTag: null, streak: 0 },
        });
        clearCounterStrikes(counter.id);
        await updateEmbed(message, counter, 0, 0, null);
        if (brokenStreak >= 10) {
          await message.channel.send(`💔 **Streak broken at ${brokenStreak}!** The highest streak was ${counter.highestStreak}.`);
        }
        return;
      }

      const newStreak = counter.streak + 1;
      const newHighest = Math.max(newStreak, counter.highestStreak);
      await prisma.counter.update({
        where: { id: counter.id },
        data: { currentNumber: value, position: counter.position + 1, lastUserId: message.author.id, lastUserTag: message.author.tag, streak: newStreak, highestStreak: newHighest },
      });

      await prisma.countHistory.create({
        data: { guildId: message.guild.id, userId: message.author.id, number: value, expression },
      });

      let highestCounts = await prisma.highestCounts.findFirst();
      if (!highestCounts) {
        highestCounts = await prisma.highestCounts.create({ data: { normal: 0, fibonacci: 0, prime: 0, even: 0, odd: 0, squares: 0 } });
      }

      const updateData = {};
      if (modeName === 'normal' && value > highestCounts.normal) updateData.normal = value;
      else if (modeName === 'fibonacci' && value > highestCounts.fibonacci) updateData.fibonacci = value;
      else if (modeName === 'prime' && value > highestCounts.prime) updateData.prime = value;
      else if (modeName === 'even' && value > highestCounts.even) updateData.even = value;
      else if (modeName === 'odd' && value > highestCounts.odd) updateData.odd = value;
      else if (modeName === 'squares' && value > highestCounts.squares) updateData.squares = value;

      if (Object.keys(updateData).length > 0) {
        await prisma.highestCounts.update({ where: { id: highestCounts.id }, data: updateData });
      }

      await message.react('✅');
      await updateEmbed(message, counter, value, newStreak, message.author.id);

      if (modeName === 'squares' && SQUARES_SHORTHAND.test(message.content.trim())) {
        const strikeKey = `${counter.id}:${message.author.id}`;
        const strikes = (squaresFormatWarnings.get(strikeKey) ?? 0) + 1;
        squaresFormatWarnings.set(strikeKey, strikes);

        if (strikes === 1) {
          await message.reply('⚠️ Tip: In squares mode, just type the number directly (e.g. `16`) instead of `x^2`. Do it again and the counter resets!');
        } else {
          squaresFormatWarnings.delete(strikeKey);
          await message.react('❌');
          const brokenStreak = counter.streak;
          await prisma.counter.update({
            where: { id: counter.id },
            data: { currentNumber: 0, position: 0, lastUserId: null, lastUserTag: null, streak: 0 },
          });
          clearCounterStrikes(counter.id);
          await updateEmbed(message, counter, 0, 0, null);
          await message.reply(`❌ Counter reset! Please type the number directly, not \`x^2\`.`);
          if (brokenStreak >= 10) {
            await message.channel.send(`💔 **Streak broken at ${brokenStreak}!** The highest streak was ${counter.highestStreak}.`);
          }
        }
      }
    } else if (isValid) {
      await message.react('❌');
      const expected = mode.getExpectedDescription(counter.currentNumber);
      await message.reply(`❌ Wrong number! Expected ${expected}, but got ${value}`);
      const brokenStreak = counter.streak;
      await prisma.counter.update({
        where: { id: counter.id },
        data: { currentNumber: 0, position: 0, lastUserId: null, lastUserTag: null, streak: 0 },
      });
      clearCounterStrikes(counter.id);
      await updateEmbed(message, counter, 0, 0, null);
      if (brokenStreak >= 10) {
        await message.channel.send(`💔 **Streak broken at ${brokenStreak}!** The highest streak was ${counter.highestStreak}.`);
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Error processing count');
  }
}

module.exports = handleMessage;
