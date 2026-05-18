const { EmbedBuilder } = require('discord.js');

const MODE_RULES = {
  normal: '• Count up by **1** each time (1, 2, 3…)\n• No counting twice in a row\n• Math expressions allowed (e.g. `2^3`, `sqrt(16)`)',
  fibonacci: '• Follow the **Fibonacci sequence** (1, 1, 2, 3, 5, 8…)\n• No counting twice in a row\n• Math expressions allowed',
  prime: '• Count **prime numbers** only (2, 3, 5, 7, 11…)\n• No counting twice in a row\n• Math expressions allowed',
  even: '• Count **even numbers** only (2, 4, 6, 8…)\n• No counting twice in a row\n• Math expressions allowed',
  odd: '• Count **odd numbers** only (1, 3, 5, 7…)\n• No counting twice in a row\n• Math expressions allowed',
  squares: '• Count **perfect squares** only (1, 4, 9, 16, 25…)\n• No counting twice in a row\n• Type the number directly — **not** `x^2`',
};

const MODE_COLORS = {
  normal: 0x5865F2,
  fibonacci: 0xF4A460,
  prime: 0xED4245,
  even: 0x57F287,
  odd: 0xFEE75C,
  squares: 0xEB459E,
};

function buildCounterEmbed(mode, currentNumber, streak, lastUserId = null) {
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
  const rules = MODE_RULES[mode] ?? MODE_RULES.normal;
  const color = MODE_COLORS[mode] ?? 0x5865F2;

  const countValue = currentNumber > 0
    ? `**${currentNumber}**${lastUserId ? `\n<@${lastUserId}>` : ''}`
    : '—';

  return new EmbedBuilder()
    .setTitle('🔢 Counting Channel')
    .setColor(color)
    .addFields(
      { name: '📊 Mode', value: modeLabel, inline: true },
      { name: '▶️ Starting At', value: '**1**', inline: true },
      { name: '🔢 Current Count', value: countValue, inline: true },
      { name: '🔥 Streak', value: streak > 0 ? `**${streak}**` : '—', inline: true },
      { name: '📋 Rules', value: rules },
    )
    .setFooter({ text: 'Good luck!' })
    .setTimestamp();
}

module.exports = { buildCounterEmbed };
