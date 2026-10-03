(() => {
  const KEY = 'virtual-instagram-world-v17';
  const DAY = 86400000;
  const SLOT = 20 * 60000;
  const PEOPLE = window.VirtualInstagramData.people;
  const SOCIAL = window.VISocialEngine;
  const REL = window.VIRelationships;
  const FACTORY = window.VIWorldFactory;

  function fresh() {
    return {
      seeded: false, lastTick: Date.now(), counter: 0,
      generatedPosts: [], notifications: [], likeDeltas: {},
      comments: {}, stories: [], seenUserPosts: [], pending: [],
      myFollowers: 0
    };
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        ...fresh(), ...raw,
        generatedPosts: raw.generatedPosts || [],
        notifications: raw.notifications || [],
        likeDeltas: raw.likeDeltas || {},
        comments: raw.comments || {},
        stories: raw.stories || [],
        seenUserPosts: raw.seenUserPosts || [],
        pending: raw.pending || []
      };
    } catch { return fresh(); }
  }
  let state = load();
  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event('vi-world-change'));
  };
  const person = (id) => PEOPLE.find((p) => p.id === id);

  function notify(ownerId, type, text, postId = null, createdAt = Date.now()) {
    const p = person(ownerId);
    state.notifications.unshift({
      id: 'n-' + createdAt + '-' + state.counter++,
      ownerId, avatar: p?.avatar || '', username: p?.username || '',
      type, text, postId, createdAt, read: false
    });
    state.notifications = state.notifications.slice(0, 60);
  }
  const nextIndex = () => state.counter++;
  const makeStory = (ownerId, createdAt = Date.now()) =>
    FACTORY.makeStory(ownerId, createdAt, nextIndex);
  const makeNpcPost = (ownerId, createdAt = Date.now()) =>
    FACTORY.makePost(ownerId, createdAt, nextIndex);

  function addWorldComment(postId, ownerId, text = '', createdAt = Date.now(), replyTo = '') {
    const p = person(ownerId);
    if (!p) return;
    state.comments[postId] ||= [];
    if (state.comments[postId].length >= 20) return;
    state.comments[postId].push({
      id: 'wc-' + createdAt + '-' + state.counter++,
      ownerId, author: p.username, avatar: p.avatar,
      text: text || SOCIAL.comment(ownerId, { caption: '' }, state.counter),
      createdAt, liked: false, mine: false, world: true, replyTo
    });
  }
  function queue(event) {
    state.pending.push({ id: 'e-' + Date.now() + '-' + state.counter++, ...event });
    state.pending.sort((a, b) => a.at - b.at);
  }
  function interactWithNpcPost(post) {
    const candidates = PEOPLE
      .filter((p) => p.id !== post.ownerId)
      .map((p) => ({
        id: p.id,
        score: REL.score(p.id, post.ownerId, 'comment', SOCIAL.interestBoost(p.id, post))
      }))
      .sort((a, b) => b.score - a.score);
    const top = candidates[0];
    if (top?.score >= 42) {
      state.likeDeltas[post.id] = 1 + Math.floor(top.score / 35);
      REL.record(top.id, post.ownerId, 'like');
    }
    if (top?.score >= 58) {
      addWorldComment(post.id, top.id, SOCIAL.comment(top.id, post, state.counter), post.createdAt + 45000);
      REL.record(top.id, post.ownerId, 'comment');
    }
  }
  function scheduleUserPost(post) {
    const ranked = SOCIAL.actorRanking('me', 'comment', post);
    ranked.slice(0, 3).forEach(({ actor, score }, index) => {
      if (score >= 32) queue({ type: 'like', actor, postId: post.id, at: Date.now() + 8000 + index * 26000 });
      if (score >= 54) queue({
        type: 'comment', actor, postId: post.id,
        text: SOCIAL.comment(actor, post, state.counter + index),
        at: Date.now() + 24000 + index * 52000
      });
      if (score >= 82 && index === 0) queue({
        type: 'dm', actor,
        text: SOCIAL.dmOpener(actor, state.counter),
        at: Date.now() + 120000
      });
    });
  }
  function reactToNewUserPosts(myPosts) {
    for (const post of myPosts || []) {
      if (state.seenUserPosts.includes(post.id)) continue;
      state.seenUserPosts.push(post.id);
      scheduleUserPost(post);
    }
    state.seenUserPosts = state.seenUserPosts.slice(-40);
  }
  function processPending(now = Date.now()) {
    const due = state.pending.filter((event) => event.at <= now);
    state.pending = state.pending.filter((event) => event.at > now);
    for (const event of due) {
      if (event.type === 'like') {
        state.likeDeltas[event.postId] = Number(state.likeDeltas[event.postId] || 0) + 1;
        REL.record(event.actor, 'me', 'like');
        notify(event.actor, 'like', '按讚了你的貼文', event.postId, event.at);
      }
      if (event.type === 'comment' || event.type === 'reply') {
        addWorldComment(event.postId, event.actor, event.text, event.at, event.replyTo || '');
        REL.record(event.actor, 'me', event.type === 'reply' ? 'reply' : 'comment');
        notify(event.actor, 'comment', '留言：' + event.text, event.postId, event.at);
      }
      if (event.type === 'story') {
        REL.record(event.actor, 'me', 'story');
        notify(event.actor, 'story', '回覆你的限時動態：' + event.text, null, event.at);
        window.VIDM?.receiveNpc(event.actor, '回覆你的限時動態：' + event.text, event.at, 'story');
      }
      if (event.type === 'dm') window.VIDM?.receiveNpc(event.actor, event.text, event.at);
      if (event.type === 'follow') {
        REL.setFollowingMe(event.actor, true);
        state.myFollowers = Number(state.myFollowers || 0) + 1;
        notify(event.actor, 'follow', '開始追蹤你', null, event.at);
      }
    }
  }
  function seed() {
    if (state.seeded) return;
    const now = Date.now();
    state.stories = PEOPLE.map((p, i) => makeStory(p.id, now - (i + 1) * 19 * 60000));
    state.generatedPosts = [makeNpcPost('kai', now - 11 * 60000), makeNpcPost('yu', now - 43 * 60000), makeNpcPost('noah', now - 76 * 60000), makeNpcPost('ryan', now - 108 * 60000)].filter(Boolean);
    state.generatedPosts.forEach(interactWithNpcPost);
    notify('leo', 'follow', '開始追蹤你', null, now - 8 * 60000);
    notify('kai', 'activity', '剛剛更新了貼文', state.generatedPosts[0]?.id, now - 11 * 60000);
    state.seeded = true;
    state.lastTick = now;
    save();
  }
  function scheduleAmbientUserInteraction(post, at) {
    const ranked = SOCIAL.actorRanking('me', 'comment', post);
    const pick = ranked[state.counter % Math.max(1, ranked.length)];
    if (!pick || pick.score < 32) return;
    queue({ type: 'like', actor: pick.actor, postId: post.id, at: at + 2 * 60000 });
    if (pick.score >= 58 && state.counter % 2 === 0) {
      queue({
        type: 'comment', actor: pick.actor, postId: post.id,
        text: SOCIAL.comment(pick.actor, post, state.counter),
        at: at + 4 * 60000
      });
    }
  }

  function simulateSlot(at, myPosts) {
    const owners = PEOPLE.map((p) => p.id);
    const owner = owners[state.counter % owners.length];
    if (state.counter % 2 === 0) {
      const post = makeNpcPost(owner, at);
      if (post) {
        state.generatedPosts.unshift(post);
        interactWithNpcPost(post);
        notify(owner, 'activity', '更新了貼文', post.id, at);
      }
    }
    if (state.counter % 3 === 0) state.stories.push(makeStory(owner, at));
    const target = (myPosts || [])[0];
    if (target) scheduleAmbientUserInteraction(target, at);
    const followCandidate = owners.find((id) =>
      !REL.follows(id, 'me') && REL.intimacy(id, 'me') >= 45
    );
    if (followCandidate && state.counter % 4 === 0) {
      queue({ type: 'follow', actor: followCandidate, at: at + 60000 });
    }
  }
  async function tick(myPosts = []) {
    seed();
    reactToNewUserPosts(myPosts);
    const now = Date.now();
    processPending(now);
    const elapsed = Math.max(0, now - Number(state.lastTick || now));
    const slots = Math.min(6, Math.floor(elapsed / SLOT));
    for (let i = slots; i > 0; i--) simulateSlot(now - (i - 1) * SLOT, myPosts);
    if (slots) state.lastTick = Number(state.lastTick || now) + slots * SLOT;
    processPending(now);
    state.generatedPosts = state.generatedPosts.filter(Boolean).slice(0, 20);
    state.stories = state.stories.filter((s) => s && s.expiresAt > now).slice(-20);
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
    SOCIAL.actorRanking('me', 'story', { caption }).slice(0, 2).forEach(({ actor, score }, i) => {
      if (score >= 45) queue({
        type: 'story', actor, text: SOCIAL.storyReply(actor, state.counter + i),
        at: now + 15000 + i * 35000
      });
    });
    save();
  }
  function scheduleCommentReply(postId, actor, userText) {
    if (!person(actor)) return;
    queue({
      type: 'reply', actor, postId,
      replyTo: window.VIStore?.state().me.username || '你',
      text: SOCIAL.reply(actor, userText, state.counter),
      at: Date.now() + 12000
    });
    save();
  }

  const extraPosts = () => state.generatedPosts || [];
  const likeDelta = (id) => Number(state.likeDeltas[id] || 0);
  const comments = (id) => state.comments[id] || [];
  function toggleCommentLike(postId, commentId) {
    const item = comments(postId).find((c) => c.id === commentId);
    if (item) { item.liked = !item.liked; save(); }
  }
  const myFollowerCount = () => PEOPLE.filter((p) => REL.follows(p.id, 'me')).length;
  const stories = () => (state.stories || []).filter((s) => s.expiresAt > Date.now());
  const notifications = () => state.notifications || [];
  const unreadCount = () => notifications().filter((n) => !n.read).length;
  function markNotificationsRead() { state.notifications.forEach((n) => { n.read = true; }); save(); }

  window.VIWorld = {
    tick, extraPosts, likeDelta, comments, toggleCommentLike,
    myFollowerCount, stories, addMyStory, scheduleCommentReply,
    notifications, unreadCount, markNotificationsRead
  };
})();