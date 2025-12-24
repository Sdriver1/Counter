# CountingBot

[📖 Documentation](http://localhost:5500) • [🐛 Report Bug](https://github.com/Sdriver1/Counter/issues) • [✨ Request Feature](https://github.com/Sdriver1/Counter/issues)

## Introduction

CountingBot, developed by [Sdriver1](https://sdriver1.dev/), is a Discord bot designed for counting with a twist. Users count sequentially, but can use mathematical expressions to make it interesting! Features multiple counting modes (normal, fibonacci, prime), user management (blacklist/whitelist), and comprehensive statistics tracking.

## Features

CountingBot offers a range of features to make counting fun and challenging:

- **Multiple Counting Modes**: Choose between normal sequential counting, fibonacci sequence, or prime numbers only
- **Math Expression Support**: Use complex math like `2^3`, `sqrt(16)`, or `(5*2)+1` to count
- **User Management**: Blacklist/whitelist users, set channel slowmode, and manage permissions
- **Statistics Tracking**: View server stats, leaderboards, and bot-wide statistics
- **Persistent Storage**: All counts are saved with SQLite database
- **Auto-Reset**: Wrong numbers reset the counter automatically
- **Anti-Spam**: Prevents users from counting twice in a row

## Getting Started

To use CountingBot in your Discord server, follow these steps:

1. **Invite the Bot**: Add CountingBot to your Discord server (self-hosted only at the moment)
2. **Setup Channel**: Run `/setup-counter` in the channel where you want counting to happen
3. **Choose Mode**: Select your preferred counting mode (normal, fibonacci, or prime)
4. **Start Counting**: Users can now start counting in the designated channel!

## Commands

Here is a list of the commands you can use with CountingBot:

- **Setup**

  - `/setup-counter` - Set up counting in a channel with optional mode and channel selection

- **Management** (Admin only)

  - `/counter-setting mode` - Change the counting mode
  - `/counter-setting slowmode` - Set channel slowmode (0-21600 seconds)
  - `/counter-setting blacklist` - Blacklist a user from counting
  - `/counter-setting unblacklist` - Remove user from blacklist
  - `/counter-setting whitelist` - Add user to whitelist (only whitelisted can count)
  - `/counter-setting unwhitelist` - Remove user from whitelist
  - `/counter-setting reset` - Reset the counter to 0

- **Statistics**
  - `/stats` - View server counting statistics and leaderboards
  - `/botstats` - View bot-wide statistics across all servers

## Counting Modes

- **Normal Mode**: Sequential counting (1, 2, 3, 4, 5...)
- **Fibonacci Mode**: Fibonacci sequence (1, 1, 2, 3, 5, 8, 13, 21...)
- **Prime Mode**: Only prime numbers (2, 3, 5, 7, 11, 13, 17, 19...)

## Math Expressions

Users can count using mathematical expressions:

- Addition: `1+1` → 2
- Multiplication: `2*2` → 4
- Powers: `2^3` → 8
- Complex: `(5*2)+1` → 11
- Square Root: `sqrt(16)` → 4
- Division: `10/2` → 5

## Contribution

Contributions to CountingBot are welcome! If you're interested in contributing, please:

- **Issues**: Report bugs or suggest features via [GitHub Issues](https://github.com/Sdriver1/Counter/issues)
- **Pull Requests**: Feel free to submit PRs with improvements or bug fixes
- **Fork**: Fork the repository and make your own modifications

## Support

For questions or feedback about CountingBot, you can:

- Open an issue on [GitHub](https://github.com/Sdriver1/Counter/issues)

## 📜 Legal

| Document    | Description         |
| ----------- | ------------------- |
| MIT License | Open source license |

Made with ❤️ by Sdriver1

🔢 CountingBot © 2025 - Count stuff. Do math. Have fun.

[GitHub](https://github.com/Sdriver1/Counter) • [Website](https://counter.sdriver1.me/)
