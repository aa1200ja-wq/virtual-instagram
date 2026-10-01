(function () {
  const data = window.VirtualInstagramData;
  const me = data?.me;
  if (!me) return;

  const DB_NAME = 'virtual-instagram-db';
  const STORE = 'my-posts';
  const LIKE_KEY = 'virtual-instagram-my-likes';
  let db;
  let renderedPosts = [];
  let openPostIndex = -1;

  const grid = document.querySelector('.me-grid');
  const empty = document.querySelector('.me-empty');
  const detail = document.querySelector('.me-post-detail');

  init();

  async function init() {
    applyTheme();
    renderIdentity();
    bindUI();
    db = await openDb();
    window.MyProfileEditor?.init();
    await refreshPosts();
  }

  function applyTheme() {
    document.documentElement.classList.toggle(
      'darkTheme',
      localStorage.getItem('theme') === 'dark'
    );
  }

  function renderIdentity() {
    setText('.me-account__name', me.username);
    setText('.me-display-name', me.displayName);
    setText('.me-bio-text', me.bio || '');
    setText('.me-followers', me.followers || '0');
    setText('.me-following', me.following || '0');
    document.querySelectorAll('.me-avatar, .me-nav-avatar').forEach((img) => {
      img.src = me.avatar;
      img.alt = me.username + ' 的大頭貼';
    });
  }

  function bindUI() {
    document.querySelector('.detail-back').addEventListener('click', closeDetail);
    document.querySelector('.detail-like').addEventListener('click', toggleLike);
    window.addEventListener('my-profile-publish', async (event) => {
      const { blob, caption } = event.detail;
      await idbRequest('readwrite', (store) => store.put({
        id: 'my-' + Date.now(),
        imageBlob: blob,
        caption,
        likes: 0,
        createdAt: Date.now()
      }));
      await refreshPosts();
    });
  }

  async function refreshPosts() {
    revokeUrls();
    const saved = db ? await idbRequest('readonly', (store) => store.getAll()) : [];
    const uploaded = saved.sort((a,b) => b.createdAt-a.createdAt).map((post) => ({
      ...post,
      image: URL.createObjectURL(post.imageBlob),
      date: timeAgo(post.createdAt),
      isObjectUrl: true
    }));
    renderedPosts = [...uploaded, ...(me.posts || [])];
    renderGrid();
  }

  function renderGrid() {
    grid.textContent = '';
    setText('.me-post-count', renderedPosts.length.toLocaleString());
    grid.hidden = renderedPosts.length === 0;
    empty.hidden = renderedPosts.length !== 0;
    renderedPosts.forEach((post,index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.innerHTML = '<img src="' + post.image + '" alt="我的貼文" />';
      item.addEventListener('click', () => openDetail(index));
      grid.appendChild(item);
    });
  }

  function openDetail(index) {
    openPostIndex = index;
    const post = renderedPosts[index];
    setText('.detail-account', me.username);
    setText('.detail-username', me.username);
    setText('.detail-caption__user', me.username);
    setText('.detail-caption__text', post.caption || '');
    setText('.detail-date', post.date || '');
    document.querySelector('.detail-avatar').src = me.avatar;
    document.querySelector('.detail-image').src = post.image;
    syncLikeUi();
    detail.classList.add('me-post-detail--open');
    detail.setAttribute('aria-hidden', 'false');
  }

  function closeDetail() {
    detail.classList.remove('me-post-detail--open');
    detail.setAttribute('aria-hidden', 'true');
    openPostIndex = -1;
  }

  function currentPostKey() {
    const post = renderedPosts[openPostIndex];
    return post?.id || 'static-' + openPostIndex;
  }

  function likeMap() {
    try { return JSON.parse(localStorage.getItem(LIKE_KEY)) || {}; }
    catch { return {}; }
  }

  function toggleLike() {
    if (openPostIndex < 0) return;
    const map = likeMap();
    const key = currentPostKey();
    map[key] = !map[key];
    localStorage.setItem(LIKE_KEY, JSON.stringify(map));
    syncLikeUi();
  }

  function syncLikeUi() {
    const post = renderedPosts[openPostIndex];
    if (!post) return;
    const liked = Boolean(likeMap()[currentPostKey()]);
    const button = document.querySelector('.detail-like');
    button.classList.toggle('is-liked', liked);
    button.querySelector('.detail-like__heart').textContent = liked ? '♥' : '♡';
    setText('.detail-likes', (Number(post.likes || 0) + (liked ? 1 : 0)).toLocaleString() + ' 個讚');
  }

  function openDb() {
    return new Promise((resolve,reject) => {
      const req = indexedDB.open(DB_NAME,1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE,{keyPath:'id'});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbRequest(mode, action) {
    return new Promise((resolve,reject) => {
      const req = action(db.transaction(STORE,mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function revokeUrls() {
    renderedPosts.forEach((p) => {
      if (p.isObjectUrl && p.image) URL.revokeObjectURL(p.image);
    });
  }

  function timeAgo(ts) {
    const m = Math.max(1, Math.floor((Date.now()-ts)/60000));
    if (m < 60) return m + ' 分鐘前';
    const h = Math.floor(m/60);
    if (h < 24) return h + ' 小時前';
    return Math.floor(h/24) + ' 天前';
  }

  function setText(selector,value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }
})();
