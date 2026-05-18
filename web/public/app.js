/* ── Mockup timestamps ───────────────────────────────────── */
(function () {
  const now = Date.now();
  const entries = [
    { id: 'ts-sdriver1', offset: -60000 },
    { id: 'ts-mike', offset: -30000 },
    { id: 'ts-pridebot', offset: 0 },
    { id: 'ts-ac', offset: 0 },
  ];
  entries.forEach(({ id, offset }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const d = new Date(now + offset);
    el.textContent = 'Today at ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  });
})();

/* ── Mockup reactions (DB-backed, localStorage toggle) ───── */
async function loadReactions() {
  try {
    const res = await fetch('/api/reactions');
    if (!res.ok) return;
    const counts = await res.json();
    document.querySelectorAll('.mockup-reaction[data-reaction-id]').forEach(btn => {
      const id = btn.dataset.reactionId;
      const countEl = btn.querySelector('.reaction-count');
      if (countEl && counts[id] != null) countEl.textContent = counts[id];
      const reacted = localStorage.getItem(`reaction:${id}`) === 'true';
      btn.classList.toggle('reacted', reacted);
    });
  } catch { /* silently fail */ }
}

document.querySelectorAll('.mockup-reaction[data-reaction-id]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.reactionId;
    const reacted = localStorage.getItem(`reaction:${id}`) === 'true';
    const action = reacted ? 'remove' : 'add';
    const countEl = btn.querySelector('.reaction-count');

    // Optimistic update
    const current = Number(countEl?.textContent ?? 1);
    if (countEl) countEl.textContent = Math.max(1, current + (action === 'add' ? 1 : -1));
    btn.classList.toggle('reacted', !reacted);
    localStorage.setItem(`reaction:${id}`, String(!reacted));

    try {
      const res = await fetch(`/api/reactions/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const { count } = await res.json();
        if (countEl) countEl.textContent = count;
      }
    } catch { /* keep optimistic value on network failure */ }
  });
});

loadReactions();

/* ── Mode card modal ─────────────────────────────────────── */
const modeModal = document.getElementById('modeModal');
const modeModalClose = document.getElementById('modeModalClose');
const modalTitle = document.getElementById('modalTitle');
const modalCmdSetup = document.getElementById('modalCmdSetup');
const modalCmdSetupText = document.getElementById('modalCmdSetupText');
const modalCmdSwitch = document.getElementById('modalCmdSwitch');
const modalCmdSwitchText = document.getElementById('modalCmdSwitchText');

function openModeModal(modeName, modeValue) {
  modalTitle.textContent = modeName + ' Mode — Commands';
  modalCmdSetupText.textContent = `/setup-counter counting-mode:${modeValue}`;
  modalCmdSwitchText.textContent = `/counter-setting mode new-mode:${modeValue}`;
  [modalCmdSetup, modalCmdSwitch].forEach(btn => btn.classList.remove('copied'));
  modeModal.hidden = false;
  document.body.style.overflow = 'hidden';
  modeModalClose.focus();
}

function closeModeModal() {
  modeModal.hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
  card.addEventListener('click', () => openModeModal(card.dataset.modeName, card.dataset.mode));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModeModal(card.dataset.modeName, card.dataset.mode); }
  });
});

modeModalClose?.addEventListener('click', closeModeModal);
modeModal?.addEventListener('click', e => { if (e.target === modeModal) closeModeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modeModal.hidden) closeModeModal(); });

function copyModeCmd(btn) {
  const text = btn.querySelector('code').textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1800);
  });
}

modalCmdSetup?.addEventListener('click', () => copyModeCmd(modalCmdSetup));
modalCmdSwitch?.addEventListener('click', () => copyModeCmd(modalCmdSwitch));

/* ── Expression verifier ─────────────────────────────────── */
const verifierInput = document.getElementById('verifierInput');
const verifierBtn = document.getElementById('verifierBtn');
const verifierResult = document.getElementById('verifierResult');

async function runVerifier() {
  const input = verifierInput?.value.trim();
  if (!input) return;

  verifierBtn.disabled = true;
  verifierBtn.textContent = '…';

  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    verifierResult.className = 'verifier-result';
    verifierResult.hidden = false;

    if (data.ambiguous) {
      verifierResult.classList.add('verifier-result--ambiguous');
      verifierResult.innerHTML = `
        <span class="verifier-result-icon">⚠️</span>
        <span class="verifier-result-body">
          <span class="verifier-result-main">Ambiguous — only 0s and 1s, so the bot decides at count time</span>
          <span class="verifier-result-sub">As decimal → <strong>${data.decimal?.toLocaleString()}</strong> &nbsp;|&nbsp; As binary → <strong>${data.binary?.toLocaleString()}</strong></span>
          <span class="verifier-result-sub">If the current count matches the decimal value the bot counts it as decimal, otherwise as binary.</span>
        </span>`;
    } else if (data.valid) {
      verifierResult.classList.add('verifier-result--valid');
      const sub = data.expression
        ? `<span class="verifier-result-sub">${escapeHtml(data.expression)} → ${data.value.toLocaleString()}</span>`
        : '';
      verifierResult.innerHTML = `
        <span class="verifier-result-icon">✅</span>
        <span class="verifier-result-body">
          <span class="verifier-result-main">Accepted — evaluates to ${data.value.toLocaleString()}</span>
          ${sub}
        </span>`;
    } else {
      verifierResult.classList.add('verifier-result--invalid');
      verifierResult.innerHTML = `
        <span class="verifier-result-icon">❌</span>
        <span class="verifier-result-body">
          <span class="verifier-result-main">Rejected — the bot would not accept this input</span>
          <span class="verifier-result-sub">Invalid expression, non-numeric result, or blocked pattern</span>
        </span>`;
    }
  } catch {
    verifierResult.className = 'verifier-result verifier-result--invalid';
    verifierResult.hidden = false;
    verifierResult.innerHTML = `
      <span class="verifier-result-icon">⚠️</span>
      <span class="verifier-result-body">
        <span class="verifier-result-main">Could not reach the server — try again</span>
      </span>`;
  } finally {
    verifierBtn.disabled = false;
    verifierBtn.textContent = 'Test';
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

verifierBtn?.addEventListener('click', runVerifier);
verifierInput?.addEventListener('keydown', e => { if (e.key === 'Enter') runVerifier(); });

/* ── Nav scroll ──────────────────────────────────────────── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 24);
}, { passive: true });

/* ── Mobile menu ─────────────────────────────────────────── */
const menuBtn = document.getElementById('menuBtn');
const navMobile = document.getElementById('navMobile');

menuBtn?.addEventListener('click', () => {
  const open = navMobile.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

navMobile?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navMobile.classList.remove('open'));
});

/* ── Smooth-count animation ──────────────────────────────── */
function animateTo(el, target, duration = 1400) {
  const start = performance.now();
  (function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

/* ── Stats fetch & display ───────────────────────────────── */
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const d = await res.json();

    const map = {
      totalGuilds: d.totalGuilds ?? 0,
      totalCounters: d.totalCounters ?? 0,
      totalCounts: d.totalCounts ?? 0,
      highestNormal: d.highestCounts?.normal ?? 0,
    };

    document.querySelectorAll('[data-stat]').forEach(item => {
      const key = item.dataset.stat;
      if (key in map) animateTo(item.querySelector('.stat-num'), map[key]);
    });
  } catch {
    /* silently fail — stats are optional */
  }
}

/* ── Intersection observer — reveal + stats trigger ─────── */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

const statsObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) {
    loadStats();
    statsObserver.disconnect();
  }
}, { threshold: 0.3 });

const statsStrip = document.querySelector('.stats-strip');
if (statsStrip) statsObserver.observe(statsStrip);
