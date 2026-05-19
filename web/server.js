require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const compression = require('compression');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../prisma/database');
const logger = require('../src/utils/logger');
const { verifyNumber } = require('../src/functions/counter/numberverifier');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const DASHBOARD_URL = process.env.DASHBOARD_URL || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `${DASHBOARD_URL}/auth/discord/callback`;

const MODE_COLORS = {
  normal: 0x5865F2, fibonacci: 0xF4A460, prime: 0xED4245,
  even: 0x57F287, odd: 0xFEE75C, squares: 0xEB459E,
};
const MODE_RULES = {
  normal: '• Count up by **1** each time (1, 2, 3…)\n• No counting twice in a row\n• Math expressions allowed (e.g. `2^3`, `sqrt(16)`)',
  fibonacci: '• Follow the **Fibonacci sequence** (1, 1, 2, 3, 5, 8…)\n• No counting twice in a row\n• Math expressions allowed',
  prime: '• Count **prime numbers** only (2, 3, 5, 7, 11…)\n• No counting twice in a row\n• Math expressions allowed',
  even: '• Count **even numbers** only (2, 4, 6, 8…)\n• No counting twice in a row\n• Math expressions allowed',
  odd: '• Count **odd numbers** only (1, 3, 5, 7…)\n• No counting twice in a row\n• Math expressions allowed',
  squares: '• Count **perfect squares** only (1, 4, 9, 16, 25…)\n• No counting twice in a row\n• Type the number directly — **not** `x^2`',
};

// ---------- Stats cache ----------
let statsCache = null;
let statsCacheAt = 0;
const CACHE_TTL = 30_000;

async function fetchStats() {
  const now = Date.now();
  if (statsCache && now - statsCacheAt < CACHE_TTL) return statsCache;
  const [totalCounters, totalCounts, botStats, guildRows] = await Promise.all([
    prisma.counter.count(),
    prisma.countHistory.count(),
    prisma.botStats.findFirst(),
    prisma.counter.groupBy({ by: ['guildId'] }),
  ]);
  statsCache = {
    totalCounters,
    totalCounts,
    totalGuilds: guildRows.length,
    totalUsers: botStats?.totalUsers ?? 0,
  };
  statsCacheAt = now;
  return statsCache;
}

// ---------- Discord REST helpers ----------
async function discordBotFetch(path, options = {}) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Discord API ${res.status}`), { status: res.status, body: text });
  }
  if (res.status === 204) return null;
  return res.json();
}

async function discordOAuthFetch(path, accessToken) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord OAuth API ${res.status}`);
  return res.json();
}

async function postCounterEmbed(channelId, mode) {
  const color = MODE_COLORS[mode] ?? 0x5865F2;
  const rules = MODE_RULES[mode] ?? MODE_RULES.normal;
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
  return discordBotFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [{
        title: '🔢 Counting Channel',
        color,
        fields: [
          { name: '📊 Mode', value: modeLabel, inline: true },
          { name: '▶️ Starting At', value: '**1**', inline: true },
          { name: '🔢 Current Count', value: '—', inline: true },
          { name: '🔥 Streak', value: '—', inline: true },
          { name: '📋 Rules', value: rules },
        ],
        footer: { text: 'Good luck!' },
        timestamp: new Date().toISOString(),
      }],
    }),
  });
}

// ---------- Middleware ----------
app.use(compression());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });
const dashLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });

// ---------- Auth middleware ----------
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireGuildAdmin(req, res, next) {
  const { guildId } = req.params;
  const guilds = req.session.guilds || [];
  const guild = guilds.find(g => g.id === guildId);
  const perms = guild ? BigInt(guild.permissions) : 0n;
  if (!guild || !(perms & BigInt(0x20) || perms & BigInt(0x8))) {
    return res.status(403).json({ error: 'Missing Manage Server permission' });
  }
  next();
}

// ---------- Auth routes ----------
app.get('/auth/discord', (req, res) => {
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  req.session.oauthState = state;
  req.session.save(err => {
    if (err) return res.redirect('/dashboard?error=session');
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/dashboard?error=no_code');
  if (state !== req.session.oauthState) {
    logger.warn({ state, sessionState: req.session.oauthState }, 'OAuth state mismatch');
    return res.redirect('/dashboard?error=invalid_state');
  }
  delete req.session.oauthState;

  try {
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const { access_token } = await tokenRes.json();

    const [user, guilds] = await Promise.all([
      discordOAuthFetch('/users/@me', access_token),
      discordOAuthFetch('/users/@me/guilds', access_token),
    ]);

    req.session.regenerate(err => {
      if (err) { logger.error({ err }, 'session regenerate failed'); return res.redirect('/dashboard?error=session'); }
      req.session.user = { id: user.id, username: user.username, avatar: user.avatar };
      req.session.guilds = guilds;
      req.session.save(saveErr => {
        if (saveErr) { logger.error({ saveErr }, 'session save failed'); return res.redirect('/dashboard?error=session'); }
        res.redirect('/dashboard');
      });
    });
  } catch (err) {
    logger.error({ err }, 'OAuth2 callback failed');
    res.redirect('/dashboard?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- Public API routes ----------
app.get('/api/stats', apiLimiter, async (req, res) => {
  try {
    res.json(await fetchStats());
  } catch (err) {
    logger.error({ err }, 'GET /api/stats failed');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/leaderboard', apiLimiter, async (req, res) => {
  try {
    const rows = await prisma.countHistory.groupBy({
      by: ['userId'],
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    });
    res.json({
      leaderboard: rows.map((r, i) => ({ rank: i + 1, userId: r.userId, count: r._count.userId })),
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/leaderboard failed');
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

app.get('/api/reactions', apiLimiter, async (req, res) => {
  try {
    const rows = await prisma.reactionCount.findMany();
    const result = {};
    rows.forEach(r => { result[r.id] = r.count; });
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'GET /api/reactions failed');
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

app.post('/api/reactions/:id', apiLimiter, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  if (action !== 'add' && action !== 'remove') return res.status(400).json({ error: 'Invalid action' });
  try {
    const delta = action === 'add' ? 1 : -1;
    const row = await prisma.reactionCount.upsert({
      where: { id },
      create: { id, count: action === 'add' ? 2 : 1 },
      update: { count: { increment: delta } },
    });
    const count = Math.max(1, row.count);
    if (row.count < 1) await prisma.reactionCount.update({ where: { id }, data: { count: 1 } });
    res.json({ count });
  } catch (err) {
    logger.error({ err }, 'POST /api/reactions/:id failed');
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

app.post('/api/verify', verifyLimiter, (req, res) => {
  const input = String(req.body?.input ?? '').trim();
  if (!input) return res.status(400).json({ error: 'No input provided' });
  if (input.length > 100) return res.status(400).json({ error: 'Input too long' });
  if (/^[01]+$/.test(input)) {
    const asDecimal = parseInt(input, 10);
    const asBinary = parseInt(input, 2);
    return res.json({ valid: true, ambiguous: true, decimal: isFinite(asDecimal) ? asDecimal : null, binary: isFinite(asBinary) ? asBinary : null });
  }
  if (/^\d+$/.test(input)) {
    const value = parseInt(input, 10);
    return res.json({ valid: isFinite(value), value: isFinite(value) ? value : null, expression: null });
  }
  const result = verifyNumber(input, null);
  res.json({ valid: result.isValid, value: result.value, expression: result.expression });
});

// ---------- Dashboard API routes (authenticated) ----------
app.get('/api/dashboard/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

app.get('/api/dashboard/guilds', requireAuth, dashLimiter, async (req, res) => {
  try {
    const manageGuilds = (req.session.guilds || []).filter(g => {
      const p = BigInt(g.permissions);
      return (p & BigInt(0x20)) || (p & BigInt(0x8));
    });
    const guildIds = manageGuilds.map(g => g.id);

    const botGuilds = await discordBotFetch('/users/@me/guilds');
    const botGuildIds = new Set(botGuilds.map(g => g.id));

    res.json(manageGuilds.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      botInGuild: botGuildIds.has(g.id),
      ...(!botGuildIds.has(g.id) && {
        inviteUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=6755794578369616&integration_type=0&scope=bot&guild_id=${g.id}`,
      }),
    })));
  } catch (err) {
    logger.error({ err }, 'GET /api/dashboard/guilds failed');
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

app.get('/api/dashboard/:guildId/channels', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  try {
    const channels = await discordBotFetch(`/guilds/${req.params.guildId}/channels`);
    res.json(channels.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })));
  } catch (err) {
    logger.error({ err }, 'GET channels failed');
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.get('/api/dashboard/:guildId/roles', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  try {
    const roles = await discordBotFetch(`/guilds/${req.params.guildId}/roles`);
    res.json(roles.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.color })));
  } catch (err) {
    logger.error({ err }, 'GET roles failed');
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

app.get('/api/dashboard/:guildId/counters', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  try {
    const counters = await prisma.counter.findMany({
      where: { guildId: req.params.guildId },
      include: { blacklistedUsers: true, whitelistedUsers: true, allowedRoles: true },
    });
    res.json(counters);
  } catch (err) {
    logger.error({ err }, 'GET counters failed');
    res.status(500).json({ error: 'Failed to fetch counters' });
  }
});

app.post('/api/dashboard/:guildId/counters', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  const { channelId, mode } = req.body;
  const VALID_MODES = ['normal', 'fibonacci', 'prime', 'even', 'odd', 'squares'];
  if (!channelId || !VALID_MODES.includes(mode)) return res.status(400).json({ error: 'Invalid channelId or mode' });

  try {
    const existing = await prisma.counter.findUnique({ where: { guildId_mode: { guildId: req.params.guildId, mode } } });
    if (existing) return res.status(409).json({ error: `A ${mode} counter already exists in this server` });

    const msg = await postCounterEmbed(channelId, mode);
    const counter = await prisma.counter.create({
      data: { guildId: req.params.guildId, channelId, mode, embedMessageId: msg?.id ?? null },
    });
    res.status(201).json(counter);
  } catch (err) {
    logger.error({ err }, 'POST counter failed');
    res.status(500).json({ error: err.message || 'Failed to create counter' });
  }
});

app.patch('/api/dashboard/:guildId/counters/:id', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  const { mode, reset } = req.body;
  const VALID_MODES = ['normal', 'fibonacci', 'prime', 'even', 'odd', 'squares'];

  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });

    const newMode = mode && VALID_MODES.includes(mode) ? mode : counter.mode;
    const shouldReset = reset === true || (mode && mode !== counter.mode);

    const msg = shouldReset ? await postCounterEmbed(counter.channelId, newMode) : null;

    const updated = await prisma.counter.update({
      where: { id: counter.id },
      data: {
        mode: newMode,
        ...(shouldReset && { currentNumber: 0, position: 0, lastUserId: null, lastUserTag: null, streak: 0 }),
        ...(msg && { embedMessageId: msg.id }),
      },
    });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, 'PATCH counter failed');
    res.status(500).json({ error: 'Failed to update counter' });
  }
});

app.delete('/api/dashboard/:guildId/counters/:id', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });
    await prisma.counter.delete({ where: { id: counter.id } });
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, 'DELETE counter failed');
    res.status(500).json({ error: 'Failed to delete counter' });
  }
});

// -- Blacklist --
app.post('/api/dashboard/:guildId/counters/:id/blacklist', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId || !/^\d+$/.test(userId)) return res.status(400).json({ error: 'Invalid userId' });
  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });
    await prisma.blacklistedUser.upsert({
      where: { counterId_userId: { counterId: counter.id, userId } },
      create: { counterId: counter.id, userId },
      update: {},
    });
    res.status(201).json({ userId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to blacklist' });
  }
});

app.delete('/api/dashboard/:guildId/counters/:id/blacklist/:userId', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });
    await prisma.blacklistedUser.deleteMany({ where: { counterId: counter.id, userId: req.params.userId } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from blacklist' });
  }
});

// -- Whitelist --
app.post('/api/dashboard/:guildId/counters/:id/whitelist', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId || !/^\d+$/.test(userId)) return res.status(400).json({ error: 'Invalid userId' });
  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });
    await prisma.whitelistedUser.upsert({
      where: { counterId_userId: { counterId: counter.id, userId } },
      create: { counterId: counter.id, userId },
      update: {},
    });
    res.status(201).json({ userId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to whitelist' });
  }
});

app.delete('/api/dashboard/:guildId/counters/:id/whitelist/:userId', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });
    await prisma.whitelistedUser.deleteMany({ where: { counterId: counter.id, userId: req.params.userId } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from whitelist' });
  }
});

// -- Allowed Roles --
app.post('/api/dashboard/:guildId/counters/:id/roles', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  const { roleId } = req.body;
  if (!roleId || !/^\d+$/.test(roleId)) return res.status(400).json({ error: 'Invalid roleId' });
  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });
    await prisma.allowedRole.upsert({
      where: { counterId_roleId: { counterId: counter.id, roleId } },
      create: { counterId: counter.id, roleId },
      update: {},
    });
    res.status(201).json({ roleId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add role' });
  }
});

app.delete('/api/dashboard/:guildId/counters/:id/roles/:roleId', requireAuth, dashLimiter, requireGuildAdmin, async (req, res) => {
  try {
    const counter = await prisma.counter.findFirst({ where: { id: req.params.id, guildId: req.params.guildId } });
    if (!counter) return res.status(404).json({ error: 'Counter not found' });
    await prisma.allowedRole.deleteMany({ where: { counterId: counter.id, roleId: req.params.roleId } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// ---------- Static & pages ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, '../src/assets/img')));
app.use('/svg', express.static(path.join(__dirname, '../src/assets/svg')));

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'pages', 'index.html'));
});
app.get('/dashboard', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'pages', 'dashboard.html'));
});
app.get('/invite', (req, res) => res.redirect('https://discord.com/oauth2/authorize?client_id=1453159969103810752&permissions=6755794578369616&integration_type=0&scope=bot'));
app.get('/discord', (req, res) => res.redirect('https://discord.gg/EUJNjnc8J9'));

// ---------- Error handling ----------
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled web server error');
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- Start ----------
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Web server started');
});

module.exports = app;
