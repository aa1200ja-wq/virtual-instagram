(() => {
  const LS_KEY = 'virtual-instagram-v1-demo';
  const DB_NAME = 'virtual-instagram-v1-db';
  const DB_STORE = 'my-posts';
  const SAMPLE = window.VirtualInstagramData;
  const now = () => Date.now();

  function defaultState() {
    return {
      me: { ...SAMPLE.me },
      likes: {}, saved: {}, following: {}, comments: {},
      lastView: 'feed-view'
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return {
        ...defaultState(), ...raw,
        me: { ...SAMPLE.me, ...(raw.me || {}) },
        likes: raw.likes || {}, saved: raw.saved || {},
        following: raw.following || {}, comments: raw.comments || {}
      };
    } catch { return defaultState(); }
  }

  let state = load();
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('vi-state-change'));
  }

  function personById(id) { return SAMPLE.people.find((p) => p.id === id) || null; }
  function isLiked(id) { return Boolean(state.likes[id]); }
  function toggleLike(id) { state.likes[id] = !state.likes[id]; save(); return state.likes[id]; }
  function isSaved(id) { return Boolean(state.saved[id]); }
  function toggleSaved(id) { state.saved[id] = !state.saved[id]; save(); return state.saved[id]; }
  function isFollowing(id) { return Boolean(state.following[id]); }
  function toggleFollow(id) { state.following[id] = !state.following[id]; save(); return state.following[id]; }

  function comments(id) { return state.comments[id] || []; }
  function addComment(postId, text) {
    const value = String(text || '').trim();
    if (!value) return;
    state.comments[postId] ||= [];
    state.comments[postId].push({
      id: 'c-' + now(), author: state.me.username,
      text: value, createdAt: now(), liked: false, mine: true
    });
    save();
  }
  function toggleCommentLike(postId, commentId) {
    const item = comments(postId).find((c) => c.id === commentId);
    if (!item) return;
    item.liked = !item.liked; save();
  }
  function deleteComment(postId, commentId) {
    state.comments[postId] = comments(postId).filter((c) => c.id !== commentId); save();
  }

  function updateMe(patch) { state.me = { ...state.me, ...patch }; save(); return state.me; }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) {
          req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode);
      const req = action(tx.objectStore(DB_STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  function normalizeMine(post) {
    const images = Array.isArray(post.images) ? post.images : [post.image].filter(Boolean);
    return { ...post, images, image: images[0] || '', tags: post.tags || [], location: post.location || '' };
  }

  async function getMyPosts() {
    try {
      const rows = await withStore('readonly', (s) => s.getAll());
      return (rows || []).map(normalizeMine).sort((a, b) => b.createdAt - a.createdAt);
    } catch { return []; }
  }
  async function putMyPost(post) { await withStore('readwrite', (s) => s.put(normalizeMine(post))); window.dispatchEvent(new Event('vi-posts-change')); }
  async function deleteMyPost(id) { await withStore('readwrite', (s) => s.delete(id)); delete state.likes[id]; delete state.saved[id]; delete state.comments[id]; save(); window.dispatchEvent(new Event('vi-posts-change')); }

  function makeNpcPost(person, post) {
    const images = Array.isArray(post.images) ? post.images : [post.image].filter(Boolean);
    return {
      ...post, images, image: images[0] || '', ownerId: person.id,
      username: person.username, name: person.name, avatar: person.avatar,
      createdAt: now() - post.minutesAgo * 60000, isMine: false
    };
  }
  function makeMine(post) {
    const p = normalizeMine(post);
    return { ...p, ownerId: 'me', username: state.me.username, name: state.me.name, avatar: state.me.avatar, likes: Number(p.likes || 0), isMine: true };
  }
  function staticNpcPosts() {
    return SAMPLE.people.flatMap((p) => p.posts.map((x) => makeNpcPost(p, x)));
  }
  function npcPosts() {
    return [...staticNpcPosts(), ...(window.VIWorld?.extraPosts() || [])];
  }
  function postsForPerson(id) {
    return npcPosts()
      .filter((post) => post.ownerId === id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async function feedPosts() {
    const mine = (await getMyPosts()).map(makeMine);
    return [...mine, ...npcPosts()].sort((a, b) => b.createdAt - a.createdAt);
  }

  window.VIStore = {
    state: () => state, save, personById,
    isLiked, toggleLike, isSaved, toggleSaved,
    isFollowing, toggleFollow, comments, addComment,
    toggleCommentLike, deleteComment, updateMe,
    getMyPosts, putMyPost, deleteMyPost,
    makeNpcPost, makeMine, npcPosts, postsForPerson, feedPosts
  };
})();