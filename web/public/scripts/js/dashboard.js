(() => {
  // ── State ───────────────────────────────────────────────
  let currentGuild = null;
  let counters = [];
  let channels = [];
  let roles = [];
  let editingCounterId = null;
  let deletingCounterId = null;
  let resettingCounterId = null;

  // ── API helpers ─────────────────────────────────────────
  async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(path, opts);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  const get  = p       => api('GET',    p);
  const post = (p, b)  => api('POST',   p, b);
  const patch = (p, b) => api('PATCH',  p, b);
  const del  = p       => api('DELETE', p);

  // ── Toast ───────────────────────────────────────────────
  let toastTimer;
  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.className = `dash-toast show toast-${type}`;
    toastTimer = setTimeout(() => { el.className = 'dash-toast'; }, 3500);
  }

  // ── Modal helpers ────────────────────────────────────────
  function openModal(id)  { document.getElementById(id).hidden = false; }
  function closeModal(id) { document.getElementById(id).hidden = true; }

  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );
  document.querySelectorAll('.dash-modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.hidden = true; })
  );

  // ── View helpers ─────────────────────────────────────────
  const show = id => { document.getElementById(id).hidden = false; };
  const hide = id => { document.getElementById(id).hidden = true; };

  // ── Guild picker ─────────────────────────────────────────
  function showGuildPicker() {
    currentGuild = null;
    channels = [];
    roles = [];
    counters = [];
    show('guildPicker');
    hide('serverDash');
  }

  async function loadGuilds() {
    const grid = document.getElementById('guildGrid');
    grid.innerHTML = '<div class="dash-skeleton"></div><div class="dash-skeleton"></div><div class="dash-skeleton"></div>';
    try {
      const guilds = await get('/api/dashboard/guilds');
      grid.innerHTML = '';
      document.getElementById('noGuildsMsg').hidden = guilds.length > 0;

      const managed  = guilds.filter(g => g.botInGuild);
      const invitable = guilds.filter(g => !g.botInGuild);

      if (managed.length)  grid.appendChild(buildGuildSection('Manage Servers', managed, false));
      if (invitable.length) grid.appendChild(buildGuildSection('Invite Bot', invitable, true));
    } catch (err) {
      grid.innerHTML = '';
      toast('Failed to load servers: ' + err.message, 'error');
    }
  }

  function buildGuildSection(title, guilds, isInvite) {
    const section = document.createElement('div');
    section.className = 'dash-guild-section';
    const h = document.createElement('h3');
    h.className = 'dash-guild-section-title';
    h.textContent = title;
    const inner = document.createElement('div');
    inner.className = 'dash-guild-inner-grid';
    guilds.forEach(g => inner.appendChild(buildGuildCard(g, isInvite)));
    section.appendChild(h);
    section.appendChild(inner);
    return section;
  }

  function buildGuildCard(guild, isInvite = false) {
    const card = document.createElement('div');
    card.className = 'dash-guild-card' + (isInvite ? ' dash-guild-card--invite' : '');
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    const iconHtml = guild.icon
      ? `<img class="dash-guild-card-icon" src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128" alt="" loading="lazy">`
      : `<div class="dash-guild-card-initials">${guild.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>`;
    const badge = isInvite ? `<span class="dash-guild-card-invite-badge">+ Invite</span>` : '';
    card.innerHTML = `${iconHtml}<span class="dash-guild-card-name">${escHtml(guild.name)}</span>${badge}`;
    if (isInvite) {
      const go = () => window.open(guild.inviteUrl, '_blank', 'noopener');
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
    } else {
      const go = () => showServerDash(guild);
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
    }
    return card;
  }

  // ── Server dashboard ──────────────────────────────────────
  function showServerDash(guild) {
    currentGuild = guild;
    hide('guildPicker');
    show('serverDash');

    const icon = document.getElementById('dashGuildIcon');
    document.getElementById('dashGuildName').textContent = guild.name;
    if (guild.icon) {
      icon.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`;
      icon.hidden = false;
    } else {
      icon.hidden = true;
    }

    setTab('counters');
    loadCounters();
  }

  document.getElementById('backBtn').addEventListener('click', showGuildPicker);

  // ── Tabs ─────────────────────────────────────────────────
  function setTab(tab) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('paneCounters').hidden = tab !== 'counters';
    document.getElementById('paneSettings').hidden = tab !== 'settings';
    if (tab === 'settings') loadSettings();
  }

  document.querySelectorAll('.dash-tab').forEach(t =>
    t.addEventListener('click', () => setTab(t.dataset.tab))
  );

  // ── Counters tab ─────────────────────────────────────────
  async function loadCounters() {
    const list = document.getElementById('countersList');
    list.innerHTML = '<div class="dash-skeleton"></div>';
    try {
      counters = await get(`/api/dashboard/${currentGuild.id}/counters`);
      renderCounters();
      resolveChannelNames();
    } catch (err) {
      list.innerHTML = '';
      toast('Failed to load counters: ' + err.message, 'error');
    }
  }

  function renderCounters() {
    const list = document.getElementById('countersList');
    list.innerHTML = '';
    document.getElementById('noCountersMsg').hidden = counters.length > 0;
    counters.forEach(c => list.appendChild(buildCounterCard(c)));
    if (channels.length) resolveChannelNames();
  }

  function buildCounterCard(c) {
    const chName = channels.find(ch => ch.id === c.channelId)?.name ?? c.channelId;
    const card = document.createElement('div');
    card.className = 'dash-counter-card';
    card.dataset.id = c.id;
    card.innerHTML = `
      <div class="dash-counter-info">
        <span class="dash-counter-channel" data-channel-id="${c.channelId}">${escHtml(chName)}</span>
        <div class="dash-counter-meta">
          <span class="dash-mode-badge ${c.mode}">${cap(c.mode)}</span>
          <span class="dash-counter-stat">Count: <strong>${c.currentNumber}</strong></span>
          <span class="dash-counter-stat">Streak: <strong>${c.streak}</strong></span>
          <span class="dash-counter-stat">Best: <strong>${c.highestStreak}</strong></span>
        </div>
      </div>
      <div class="dash-counter-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit"   data-id="${c.id}">Edit Mode</button>
        <button class="btn btn-ghost btn-sm" data-action="reset"  data-id="${c.id}">Reset</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${c.id}">Delete</button>
      </div>`;
    card.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', e => {
      const { action, id } = e.currentTarget.dataset;
      if (action === 'edit')   openEditMode(id);
      if (action === 'reset')  openConfirmReset(id);
      if (action === 'delete') openConfirmDelete(id);
    }));
    return card;
  }

  // Add counter
  document.getElementById('addCounterBtn').addEventListener('click', async () => {
    if (!channels.length) {
      try { channels = await get(`/api/dashboard/${currentGuild.id}/channels`); }
      catch (err) { return toast('Failed to load channels: ' + err.message, 'error'); }
    }
    const sel = document.getElementById('newCounterChannel');
    sel.innerHTML = channels.map(ch => `<option value="${ch.id}">${escHtml(ch.name)}</option>`).join('');
    document.getElementById('newCounterMode').value = 'normal';
    openModal('modalAddCounter');
  });

  document.getElementById('confirmAddCounter').addEventListener('click', async () => {
    const channelId = document.getElementById('newCounterChannel').value;
    const mode = document.getElementById('newCounterMode').value;
    const btn = document.getElementById('confirmAddCounter');
    btn.disabled = true;
    try {
      const counter = await post(`/api/dashboard/${currentGuild.id}/counters`, { channelId, mode });
      counters.push(counter);
      renderCounters();
      closeModal('modalAddCounter');
      toast('Counter created!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Edit mode
  function openEditMode(id) {
    editingCounterId = id;
    document.getElementById('editModeSelect').value = counters.find(c => c.id === id)?.mode ?? 'normal';
    openModal('modalEditMode');
  }

  document.getElementById('confirmEditMode').addEventListener('click', async () => {
    const mode = document.getElementById('editModeSelect').value;
    const btn = document.getElementById('confirmEditMode');
    btn.disabled = true;
    try {
      const updated = await patch(`/api/dashboard/${currentGuild.id}/counters/${editingCounterId}`, { mode });
      counters = counters.map(c => c.id === editingCounterId ? { ...updated, blacklistedUsers: c.blacklistedUsers, whitelistedUsers: c.whitelistedUsers, allowedRoles: c.allowedRoles } : c);
      renderCounters();
      closeModal('modalEditMode');
      toast('Mode updated!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Reset
  function openConfirmReset(id) { resettingCounterId = id; openModal('modalConfirmReset'); }

  document.getElementById('confirmReset').addEventListener('click', async () => {
    const btn = document.getElementById('confirmReset');
    btn.disabled = true;
    try {
      const updated = await patch(`/api/dashboard/${currentGuild.id}/counters/${resettingCounterId}`, { reset: true });
      counters = counters.map(c => c.id === resettingCounterId ? { ...updated, blacklistedUsers: c.blacklistedUsers, whitelistedUsers: c.whitelistedUsers, allowedRoles: c.allowedRoles } : c);
      renderCounters();
      closeModal('modalConfirmReset');
      toast('Counter reset to 0.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Delete
  function openConfirmDelete(id) { deletingCounterId = id; openModal('modalConfirmDelete'); }

  document.getElementById('confirmDelete').addEventListener('click', async () => {
    const btn = document.getElementById('confirmDelete');
    btn.disabled = true;
    try {
      await del(`/api/dashboard/${currentGuild.id}/counters/${deletingCounterId}`);
      counters = counters.filter(c => c.id !== deletingCounterId);
      renderCounters();
      closeModal('modalConfirmDelete');
      toast('Counter deleted.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Settings tab ─────────────────────────────────────────
  async function loadSettings() {
    const sel = document.getElementById('settingsCounterSelect');
    sel.innerHTML = '';
    document.getElementById('noCountersSettingsMsg').hidden = counters.length > 0;
    document.getElementById('settingsContent').innerHTML = '';
    if (!counters.length) return;

    counters.forEach(c => {
      const ch = channels.find(x => x.id === c.channelId);
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `#${ch ? ch.name : c.channelId} (${cap(c.mode)})`;
      sel.appendChild(opt);
    });

    if (!roles.length) {
      try { roles = await get(`/api/dashboard/${currentGuild.id}/roles`); } catch { roles = []; }
    }

    // Replace onchange each time to avoid listener accumulation
    sel.onchange = () => renderSettingsFor(sel.value);
    renderSettingsFor(sel.value);
  }

  function renderSettingsFor(counterId) {
    const counter = counters.find(c => c.id === counterId);
    if (!counter) return;
    const el = document.getElementById('settingsContent');
    el.innerHTML = '';
    el.appendChild(buildListSection(
      'Blacklist',
      'These users cannot count in this channel.',
      counter.blacklistedUsers.map(u => u.userId),
      'Discord User ID (e.g. 123456789012345678)',
      /^\d{17,20}$/,
      uid => removeFromList(counter, 'blacklist', uid),
      uid => addToList(counter, 'blacklist', uid),
    ));
    el.appendChild(buildListSection(
      'Whitelist',
      'When non-empty, only these users can count.',
      counter.whitelistedUsers.map(u => u.userId),
      'Discord User ID (e.g. 123456789012345678)',
      /^\d{17,20}$/,
      uid => removeFromList(counter, 'whitelist', uid),
      uid => addToList(counter, 'whitelist', uid),
    ));
    el.appendChild(buildRolesSection(counter));
  }

  function buildListSection(title, desc, items, placeholder, pattern, onRemove, onAdd) {
    const section = document.createElement('div');
    section.className = 'dash-settings-section';
    section.innerHTML = `
      <h4>${title}</h4>
      <p class="dash-settings-desc">${desc}</p>
      <div class="dash-tag-list"></div>
      <div class="dash-input-row">
        <input class="dash-input" placeholder="${placeholder}" maxlength="24" />
        <button class="btn btn-primary btn-sm">Add</button>
      </div>`;

    const tagList = section.querySelector('.dash-tag-list');
    const input   = section.querySelector('input');
    const addBtn  = section.querySelector('button');

    const makeTag = item => buildTag(item, () => {
      onRemove(item)
        .then(() => { section.querySelector(`[data-val="${CSS.escape(item)}"]`)?.remove(); toast('Removed.'); })
        .catch(err => toast(err.message, 'error'));
    });

    items.forEach(item => tagList.appendChild(makeTag(item)));

    addBtn.addEventListener('click', () => {
      const val = input.value.trim();
      if (!pattern.test(val)) return toast('Invalid ID — must be 17–20 digits', 'error');
      if (section.querySelector(`[data-val="${CSS.escape(val)}"]`)) return toast('Already in list', 'error');
      onAdd(val)
        .then(() => { tagList.appendChild(makeTag(val)); input.value = ''; toast('Added!'); })
        .catch(err => toast(err.message, 'error'));
    });

    input.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });
    return section;
  }

  function buildRolesSection(counter) {
    const section = document.createElement('div');
    section.className = 'dash-settings-section';
    section.innerHTML = `
      <h4>Allowed Roles</h4>
      <p class="dash-settings-desc">When set, only members with at least one of these roles can count. Leave empty to allow everyone.</p>
      <div class="dash-tag-list"></div>
      <div class="dash-input-row">
        <select class="dash-select" style="flex:1">
          <option value="">Select a role…</option>
          ${roles.map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm">Add</button>
      </div>`;

    const tagList = section.querySelector('.dash-tag-list');
    const sel     = section.querySelector('select');
    const addBtn  = section.querySelector('button');

    const makeRoleTag = (roleId, label) => buildTag(label, () => {
      removeRole(counter, roleId)
        .then(() => { section.querySelector(`[data-val="${CSS.escape(label)}"]`)?.remove(); toast('Role removed.'); })
        .catch(err => toast(err.message, 'error'));
    }, label);

    counter.allowedRoles.forEach(ar => {
      const role = roles.find(r => r.id === ar.roleId);
      tagList.appendChild(makeRoleTag(ar.roleId, role ? role.name : ar.roleId));
    });

    addBtn.addEventListener('click', () => {
      const roleId = sel.value;
      if (!roleId) return toast('Select a role first', 'error');
      const role = roles.find(r => r.id === roleId);
      const label = role ? role.name : roleId;
      if (section.querySelector(`[data-val="${CSS.escape(label)}"]`)) return toast('Role already added', 'error');
      addRole(counter, roleId)
        .then(() => { tagList.appendChild(makeRoleTag(roleId, label)); sel.value = ''; toast('Role added!'); })
        .catch(err => toast(err.message, 'error'));
    });

    return section;
  }

  function buildTag(label, onRemove, val) {
    const tag = document.createElement('span');
    tag.className = 'dash-tag';
    tag.dataset.val = val ?? label;
    tag.innerHTML = `${escHtml(label)}<button class="dash-tag-remove" aria-label="Remove">×</button>`;
    tag.querySelector('button').addEventListener('click', onRemove);
    return tag;
  }

  // ── Settings API calls ───────────────────────────────────
  async function addToList(counter, list, userId) {
    await post(`/api/dashboard/${currentGuild.id}/counters/${counter.id}/${list}`, { userId });
    (list === 'blacklist' ? counter.blacklistedUsers : counter.whitelistedUsers).push({ userId });
  }

  async function removeFromList(counter, list, userId) {
    await del(`/api/dashboard/${currentGuild.id}/counters/${counter.id}/${list}/${userId}`);
    if (list === 'blacklist') counter.blacklistedUsers = counter.blacklistedUsers.filter(u => u.userId !== userId);
    else counter.whitelistedUsers = counter.whitelistedUsers.filter(u => u.userId !== userId);
  }

  async function addRole(counter, roleId) {
    await post(`/api/dashboard/${currentGuild.id}/counters/${counter.id}/roles`, { roleId });
    counter.allowedRoles.push({ roleId });
  }

  async function removeRole(counter, roleId) {
    await del(`/api/dashboard/${currentGuild.id}/counters/${counter.id}/roles/${roleId}`);
    counter.allowedRoles = counter.allowedRoles.filter(r => r.roleId !== roleId);
  }

  // ── Channel name resolution ───────────────────────────────
  async function resolveChannelNames() {
    if (!channels.length) {
      try { channels = await get(`/api/dashboard/${currentGuild.id}/channels`); }
      catch { return; }
    }
    document.querySelectorAll('[data-channel-id]').forEach(el => {
      const ch = channels.find(c => c.id === el.dataset.channelId);
      if (ch) el.textContent = ch.name;
    });
  }

  // ── Utilities ────────────────────────────────────────────
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(location.search);
    if (params.has('error')) history.replaceState({}, '', '/dashboard');

    try {
      const { user } = await get('/api/dashboard/me');
      document.getElementById('navUsername').textContent = user.username;
      const avatar = document.getElementById('navAvatar');
      avatar.src = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) % 5n)}.png`;
      show('dashView');
      showGuildPicker();
      loadGuilds();
    } catch {
      show('loginView');
      const errKey = params.get('error');
      if (errKey) {
        const msgs = {
          invalid_state: 'Login failed: session expired or invalid state. Please try again.',
          no_code: 'Login failed: Discord did not return a code.',
          auth_failed: 'Authentication failed. Please try again.',
          session: 'Session error. Please try again.',
        };
        const errMsg = msgs[errKey] || `Login error: ${errKey}`;
        setTimeout(() => toast(errMsg, 'error'), 300);
      }
    }
  }

  init();
})();
