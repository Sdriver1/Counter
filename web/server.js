require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../prisma/database');
const logger = require('../src/utils/logger');

const { verifyNumber } = require('../src/functions/counter/numberverifier');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

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

// ---------- Middleware ----------
app.use(compression());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// ---------- API routes ----------
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
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        count: r._count.userId,
      })),
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
  if (action !== 'add' && action !== 'remove') {
    return res.status(400).json({ error: 'Invalid action' });
  }
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

  // Binary-ambiguous: all 0s and 1s — bot picks interpretation based on current count
  if (/^[01]+$/.test(input)) {
    const asDecimal = parseInt(input, 10);
    const asBinary = parseInt(input, 2);
    return res.json({
      valid: true,
      ambiguous: true,
      decimal: isFinite(asDecimal) ? asDecimal : null,
      binary: isFinite(asBinary) ? asBinary : null,
    });
  }

  // Plain decimal integer (contains non-binary digits)
  if (/^\d+$/.test(input)) {
    const value = parseInt(input, 10);
    return res.json({ valid: isFinite(value), value: isFinite(value) ? value : null, expression: null });
  }

  const result = verifyNumber(input, null);
  res.json({ valid: result.isValid, value: result.value, expression: result.expression });
});

// ---------- Static & pages ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, '../src/assets/img')));
app.use('/svg', express.static(path.join(__dirname, '../src/assets/svg')));

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
