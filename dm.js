(() => {
  const KEY = 'virtual-instagram-dm-v18b';
  const DATA = window.VirtualInstagramData;
  const REL = window.VIRelationships;
  const SOCIAL = window.VISocialEngine;
  const $ = (s, r = document) => r.querySelector(s);

  function fresh() { return { conversations: {}, seeded: false }; }
  function load() {
    try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return fresh(); }
  }
  let state = load();
  let currentId = null;
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const person = (id) => DATA.people.find((p) => p.id === id);
  const messages = (id) => state.conversations[id] || [];

  function push(id, message) {
    state.conversations[id] ||= [];
    state.conversations[id].push(message);
    state.conversations[id] = state.conversations[id].slice(-80);
    save();
    renderInbox();
    if (currentId === id) renderChat();
    updateBadge();
  }

  function receiveNpc(id, text, createdAt = Date.now(), source = 'dm') {
    const p = person(id);
    if (!p) return;
    push(id, {
      id: 'dm-' + createdAt + '-' + Math.random().toString(16).slice(2),
      from: id, text, source, createdAt, read: currentId === id
    });
    REL.record(id, 'me', source === 'story' ? 'story' : 'dm');
  }

  function nextNpcReply(id, userText) {
    const recent = messages(id)
      .filter((m) => m.from === id)
      .slice(-5)
      .map((m) => m.text);
    for (let i = 0; i < 8; i++) {
      const reply = SOCIAL.dmReply(id, userText, Date.now() + i * 17);
      if (!recent.includes(reply)) return reply;
    }
    return SOCIAL.dmReply(id, userText, Date.now() + 131);
  }

  function sendUser(id, text, source = 'dm') {
    const value = String(text || '').trim();
    if (!value || !person(id)) return;
    push(id, {
      id: 'dm-me-' + Date.now(), from: 'me',
      text: value, source, createdAt: Date.now(), read: true
    });
    REL.record('me', id, source === 'story' ? 'story' : 'dm');
    const score = REL.score(id, 'me', 'dm');
    const delay = score >= 75 ? 900 : score >= 50 ? 1600 : 2800;
    setChatStatus(id, '正在輸入…');
    setTimeout(() => {
      receiveNpc(id, nextNpcReply(id, value));
      setChatStatus(id);
    }, delay);
  }

  function sendStoryReply(id, text, story) {
    const value = String(text || '').trim();
    if (!value) return;
    sendUser(id, '回覆你的限時動態：' + value, 'story');
  }

  function unreadCount() {
    return Object.values(state.conversations).flat()
      .filter((m) => m.from !== 'me' && !m.read).length;
  }
  function updateBadge() {
    const badge = $('#dm-badge');
    if (!badge) return;
    const n = unreadCount();
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.classList.toggle('hidden', !n);
  }

  function seed() {
    if (state.seeded) return;
    const t = Date.now() - 14 * 60000;
    state.seeded = true;
    save();
    receiveNpc('kai', '剛看到你最近發的東西，蠻有你的感覺。', t);
    receiveNpc('yu', '欸～終於開私訊了喔 😏 今天想幹嘛？', t + 120000);
  }

  function renderInbox() {
    const root = $('#dm-inbox-list');
    if (!root) return;
    root.innerHTML = '';
    DATA.people.forEach((p) => {
      const list = messages(p.id);
      const last = list.at(-1);
      const unread = list.filter((m) => m.from !== 'me' && !m.read).length;
      const row = document.createElement('button');
      row.className = 'dm-inbox-row';
      row.innerHTML =
        '<img src="' + p.avatar + '" alt=""><span><strong>' + p.username +
        '</strong><small>' + (last ? last.text : '開始聊天') +
        '</small></span>' + (unread ? '<b>' + unread + '</b>' : '');
      row.onclick = () => openChat(p.id);
      root.appendChild(row);
    });
  }

  function setChatStatus(id, text = '') {
    if (currentId !== id) return;
    const status = $('#dm-chat-status');
    if (!status) return;
    status.textContent = text || (
      REL.label('me', id) + ' · 親密度 ' + REL.intimacy('me', id)
    );
  }

  function renderChat() {
    const p = person(currentId);
    if (!p) return;
    $('#dm-chat-title').textContent = p.username;
    $('#dm-chat-avatar').src = p.avatar;
    setChatStatus(currentId);
    const list = messages(currentId);
    list.forEach((m) => { if (m.from !== 'me') m.read = true; });
    save();
    const root = $('#dm-messages');
    root.innerHTML = '';
    list.forEach((m) => {
      const bubble = document.createElement('div');
      bubble.className = 'dm-message ' + (m.from === 'me' ? 'mine' : 'theirs');
      bubble.textContent = m.text;
      root.appendChild(bubble);
    });
    root.scrollTop = root.scrollHeight;
    updateBadge();
  }

  function open(id = null) {
    $('#dm-page')?.classList.add('active');
    document.body.classList.add('no-scroll');
    if (id) openChat(id);
    else showInbox();
  }
  function close() {
    $('#dm-page')?.classList.remove('active');
    document.body.classList.remove('no-scroll');
  }
  function showInbox() {
    currentId = null;
    $('#dm-inbox').classList.remove('hidden');
    $('#dm-chat').classList.add('hidden');
    renderInbox();
  }
  function openChat(id) {
    if (!person(id)) return;
    currentId = id;
    $('#dm-inbox').classList.add('hidden');
    $('#dm-chat').classList.remove('hidden');
    renderChat();
  }

  function init() {
    seed();
    $('#dm-button')?.addEventListener('click', () => open());
    $('#dm-close')?.addEventListener('click', close);
    $('#dm-chat-back')?.addEventListener('click', showInbox);
    $('#dm-chat-user')?.addEventListener('click', () => {
      close();
      window.dispatchEvent(new CustomEvent('vi-open-profile', { detail: { ownerId: currentId } }));
    });
    $('#dm-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = $('#dm-input');
      sendUser(currentId, input.value);
      input.value = '';
    });
    renderInbox();
    updateBadge();
  }

  window.VIDM = {
    init, open, close, openChat, receiveNpc,
    sendUser, sendStoryReply, unreadCount
  };
})();