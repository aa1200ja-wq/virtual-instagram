(function () {
  const data = window.VirtualInstagramData;
  const me = data?.me;
  if (!me) return;

  const DB_NAME = 'virtual-instagram-db';
  const STORE = 'my-posts';
  let db;
  let selectedFile = null;
  let previewUrl = null;
  let renderedPosts = [];

  const grid = document.querySelector('.me-grid');
  const empty = document.querySelector('.me-empty');
  const fileInput = document.querySelector('.me-file-input');
  const composer = document.querySelector('.me-composer');
  const postModal = document.querySelector('.me-post-modal');

  init();

  async function init() {
    applyTheme();
    renderIdentity();
    bindComposer();
    bindPostModal();
    db = await openDb();
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
    const avatar = document.querySelector('.me-avatar');
    avatar.src = me.avatar;
    avatar.alt = me.username + ' 的大頭貼';
  }

  function bindComposer() {
    document.querySelector('[data-add-post]')?.addEventListener('click', openComposer);
    document.querySelector('.me-empty__add')?.addEventListener('click', openComposer);
    document.querySelector('.me-composer__pick')?.addEventListener('click', () => fileInput.click());
    document.querySelector('.me-composer__cancel')?.addEventListener('click', closeComposer);
    composer.querySelector('.me-overlay')?.addEventListener('click', closeComposer);
    document.querySelector('.me-composer__publish')?.addEventListener('click', publishPost);
    fileInput.addEventListener('change', handleFile);
  }

  function bindPostModal() {
    postModal.querySelector('.me-overlay')?.addEventListener('click', closePost);
    postModal.querySelector('.me-post-modal__close')?.addEventListener('click', closePost);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeComposer();
        closePost();
      }
    });
  }

  function openComposer() {
    composer.classList.add('me-composer--open');
    composer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('me-modal-open');
  }

  function closeComposer() {
    composer.classList.remove('me-composer--open');
    composer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('me-modal-open');
    resetComposer();
  }

  function handleFile() {
    const file = fileInput.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    const preview = document.querySelector('.me-composer__preview');
    preview.src = previewUrl;
    preview.hidden = false;
    document.querySelector('.me-composer__caption').hidden = false;
    document.querySelector('.me-composer__pick').hidden = true;
    document.querySelector('.me-composer__publish').disabled = false;
  }

  async function publishPost() {
    if (!selectedFile || !db) return;
    const caption = document.querySelector('.me-composer__caption').value.trim();
    const post = {
      id: 'my-' + Date.now(),
      imageBlob: selectedFile,
      caption,
      likes: 0,
      createdAt: Date.now()
    };
    await idbRequest('readwrite', (store) => store.put(post));
    closeComposer();
    await refreshPosts();
  }

  async function refreshPosts() {
    revokeRenderedUrls();
    const saved = db ? await idbRequest('readonly', (store) => store.getAll()) : [];
    const uploaded = saved
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((post) => ({
        ...post,
        image: URL.createObjectURL(post.imageBlob),
        date: formatDate(post.createdAt),
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

    renderedPosts.forEach((post, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 篇貼文');
      item.innerHTML = '<img src="' + post.image + '" alt="我的貼文" />';
      item.addEventListener('click', () => openPost(index));
      grid.appendChild(item);
    });
  }

  function openPost(index) {
    const post = renderedPosts[index];
    postModal.querySelector('.me-post-modal__image').src = post.image;
    postModal.querySelector('.me-post-modal__avatar').src = me.avatar;
    postModal.querySelector('.me-post-modal__username').textContent = me.username;
    postModal.querySelector('.me-post-modal__caption').textContent =
      post.caption || '沒有說明文字';
    postModal.querySelector('.me-post-modal__date').textContent = post.date || '';
    postModal.classList.add('me-post-modal--open');
    postModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('me-modal-open');
  }

  function closePost() {
    postModal.classList.remove('me-post-modal--open');
    postModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('me-modal-open');
  }

  function resetComposer() {
    selectedFile = null;
    fileInput.value = '';
    const preview = document.querySelector('.me-composer__preview');
    preview.hidden = true;
    preview.removeAttribute('src');
    document.querySelector('.me-composer__caption').hidden = true;
    document.querySelector('.me-composer__caption').value = '';
    document.querySelector('.me-composer__pick').hidden = false;
    document.querySelector('.me-composer__publish').disabled = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idbRequest(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function revokeRenderedUrls() {
    renderedPosts.forEach((post) => {
      if (post.isObjectUrl && post.image) URL.revokeObjectURL(post.image);
    });
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }
})();
