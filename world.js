(() => {
  const KEY = 'virtual-instagram-world-v16';
  const DAY = 86400000;
  const SLOT = 15 * 60000;
  const PEOPLE = window.VirtualInstagramData.people;
  const configs = {
    kai: {
      images: ['assets/sample/kai-1.webp', 'assets/sample/kai-2.webp'],
      captions: ['剛好有空，就走遠一點。', '今天的光線不錯。', '買杯咖啡再回去。'],
      story: ['今天就慢慢來。', '路過。', '晚點見。'],
      comments: ['這張可以。', '有夠會拍', '今天很帥欸']
    },
    yu: {
      images: ['assets/sample/yu-1.webp', 'assets/sample/yu-2.webp'],
      captions: ['今天沒有行程。', '最近一直在聽這首。', '留一張。'],
      story: ['晚點再出門。', '今天黑色。', '最近的歌單。'],
      comments: ['好看。', '這張我喜歡', '可以發更多']
    },
    leo: {
      images: ['assets/sample/leo-1.webp', 'assets/sample/leo-2.webp'],
      captions: ['今晚就這樣。', '下雨也不錯。', '晚一點的台北。'],
      story: ['夜晚開始。', '雨還沒停。', '吃個東西。'],
      comments: ['可以。', '這個氛圍不錯', '有型']
    }
  };

  function fresh() {
    return {
      seeded: false, lastTick: Date.now(), counter: 0,
      generatedPosts: [], notifications: [], likeDeltas: {},
      comments: {}, stories: [], seenUserPosts: []
    };
  }
  function load() {
    try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return fresh(); }
  }
  let state = load();
  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event('vi-world-change'));
  };
  const person = (id) => PEOPLE.find((p) => p.id === id);
  const cfg = (id) => configs[id];
  const choose = (list, n) => list[n % list.length];

  function notify(ownerId, type, text, postId = null, createdAt = Date.now()) {
    const p = person(ownerId);
    state.notifications.unshift({
      id: 'n-' + createdAt + '-' + state.counter++,
      ownerId, avatar: p?.avatar || '', username: p?.username || '',
      type, text, postId, createdAt, read: false
    });
    state.notifications = state.notifications.slice(0, 50);
  }

  function makeStory(ownerId, createdAt = Date.now()) {
    const p = person(ownerId), c = cfg(ownerId);
    if (!p || !c) return null;
    const index = state.counter++;
    return {
      id: 'story-' + ownerId + '-' + createdAt,
      ownerId, username: p.username, avatar: p.avatar,
      image: choose(c.images, index), caption: choose(c.story, index),
      createdAt, expiresAt: createdAt + DAY, mine: false
    };
  }

  function makeNpcPost(ownerId, createdAt = Date.now()) {
    const p = person(ownerId), c = cfg(ownerId);
    if (!p || !c) return null;
    const index = state.counter++;
    return {
      id: 'world-' + ownerId + '-' + createdAt,
      ownerId, username: p.username, name: p.name, avatar: p.avatar,
      images: [choose(c.images, index)], image: choose(c.images, index),
      caption: choose(c.captions, index), location: index % 2 ? '台北' : '',
      tags: [], likes: 300 + (index * 137) % 2600,
      createdAt, isMine: false, generated: true
    };
  }

  function addWorldComment(postId, ownerId, createdAt = Date.now()) {
    const p = person(ownerId), c = cfg(ownerId);
    if (!p || !c) return;
    state.comments[postId] ||= [];
    if (state.comments[postId].length >= 12) return;
    const index = state.counter++;
    state.comments[postId].push({
      id: 'wc-' + createdAt + '-' + index,
      author: p.username, avatar: p.avatar,
      text: choose(c.comments, index), createdAt,
      liked: false, mine: false, world: true
    });
  }

  function seed() {
    if (state.seeded) return;
    const now = Date.now();
    state.stories = PEOPLE.map((p, i) => makeStory(p.id, now - (i + 1) * 17 * 60000));
    state.generatedPosts = [
      makeNpcPost('kai', now - 9 * 60000),
      makeNpcPost('yu', now - 37 * 60000)
    ].filter(Boolean);
    notify('leo', 'follow', '開始追蹤你', null, now - 6 * 60000);
    notify('kai', 'activity', '剛剛更新了貼文', state.generatedPosts[0]?.id, now - 9 * 60000);
    state.seeded = true;
    state.lastTick = now;
    save();
  }

  function reactToNewUserPosts(myPosts) {
    for (const post of myPosts || []) {
      if (state.seenUserPosts.includes(post.id)) continue;
      state.seenUserPosts.push(post.id);
      const owners = ['kai', 'yu', 'leo'];
      owners.slice(0, 2).forEach((ownerId, i) => {
        state.likeDeltas[post.id] = Number(state.likeDeltas[post.id] || 0) + 1;
        notify(ownerId, 'like', '按讚了你的貼文', post.id, Date.now() - i * 15000);
        if (i === 1) {
          addWorldComment(post.id, ownerId);
          notify(ownerId, 'comment', '留言：' + cfg(ownerId).comments[0], post.id);
        }
      });
    }
    state.seenUserPosts = state.seenUserPosts.slice(-30);
  }

  function simulateSlot(at, myPosts) {
    const owners = ['kai', 'yu', 'leo'];
    const ownerId = owners[state.counter % owners.length];
    if (state.counter % 2 === 0) {
      const post = makeNpcPost(ownerId, at);
      if (post) {
        state.generatedPosts.unshift(post);
        notify(ownerId, 'activity', '更新了貼文', post.id, at);
      }
    }
    const target = (myPosts || [])[0];
    if (target) {
      const actor = owners[(state.counter + 1) % owners.length];
      state.likeDeltas[target.id] = Number(state.likeDeltas[target.id] || 0) + 1;
      notify(actor, 'like', '按讚了你的貼文', target.id, at);
      if (state.counter % 3 === 0) {
        addWorldComment(target.id, actor, at);
        notify(actor, 'comment', '留言：' + cfg(actor).comments[state.counter % 3], target.id, at);
      }
    } else if (state.counter % 3 === 0) {
      notify(ownerId, 'follow', '開始追蹤你', null, at);
    }
    if (state.counter % 4 === 0) state.stories.push(makeStory(ownerId, at));
  }

  async function tick(myPosts = []) {
    seed();
    reactToNewUserPosts(myPosts);
    const now = Date.now();
    const elapsed = Math.max(0, now - Number(state.lastTick || now));
    const slots = Math.min(8, Math.floor(elapsed / SLOT));
    for (let i = slots; i > 0; i--) simulateSlot(now - (i - 1) * SLOT, myPosts);
    state.lastTick = now;
    state.generatedPosts = state.generatedPosts.filter(Boolean).slice(0, 16);
    state.stories = state.stories.filter((s) => s && s.expiresAt > now).slice(-16);
    save();
  }

  function addMyStory(image, caption = '') {
    const me = window.VIStore?.state().me || window.VirtualInstagramData.me;
    const now = Date.now();
    state.stories = state.stories.filter((s) => !s.mine);
    state.stories.unshift({
      id: 'story-me-' + now, ownerId: 'me', username: me.username,
      avatar: me.avatar, image, caption, createdAt: now,
      expiresAt: now + DAY, mine: true
    });
    save();
  }

  function extraPosts() { return state.generatedPosts || []; }
  function likeDelta(id) { return Number(state.likeDeltas[id] || 0); }
  function comments(id) { return state.comments[id] || []; }
  function stories() { return (state.stories || []).filter((s) => s.expiresAt > Date.now()); }
  function notifications() { return state.notifications || []; }
  function unreadCount() { return notifications().filter((n) => !n.read).length; }
  function markNotificationsRead() { state.notifications.forEach((n) => { n.read = true; }); save(); }

  window.VIWorld = {
    tick, extraPosts, likeDelta, comments, stories, addMyStory,
    notifications, unreadCount, markNotificationsRead
  };
})();