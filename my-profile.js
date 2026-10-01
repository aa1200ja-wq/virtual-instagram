(function () {
  const data = window.VirtualInstagramData;
  const me = data?.me;
  if (!me) return;

  const DB_NAME = 'virtual-instagram-db';
  const STORE = 'my-posts';
  let db, selectedFile, previewUrl;
  let renderedPosts = [];

  const grid = document.querySelector('.me-grid');
  const empty = document.querySelector('.me-empty');
  const fileInput = document.querySelector('.me-file-input');
  const sheet = document.querySelector('.create-sheet');
  const editor = document.querySelector('.post-editor');
  const caption = document.querySelector('.post-caption');
  const detail = document.querySelector('.me-post-detail');

  init();

  async function init() {
    applyTheme();
    renderIdentity();
    bindUI();
    db = await openDb();
    await refreshPosts();
  }

  function applyTheme() {
    document.documentElement.classList.toggle('darkTheme', localStorage.getItem('theme') === 'dark');
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
    document.querySelector('[data-add-post]')?.addEventListener('click', openSheet);
    document.querySelector('.me-empty__add')?.addEventListener('click', openSheet);
    sheet.querySelector('.screen-backdrop').addEventListener('click', closeSheet);
    document.querySelector('[data-create-post]').addEventListener('click', () => {
      closeSheet();
      fileInput.click();
    });
    document.querySelector('[data-create-reel]').addEventListener('click', showReelToast);
    fileInput.addEventListener('change', handleFile);
    document.querySelector('.flow-close').addEventListener('click', resetFlow);
    document.querySelector('.post-editor__next').addEventListener('click', openCaption);
    document.querySelector('.caption-back').addEventListener('click', backToEditor);
    document.querySelector('.caption-share').addEventListener('click', publishPost);
    document.querySelector('.detail-back').addEventListener('click', closeDetail);
  }

  function openSheet() {
    sheet.classList.add('create-sheet--open');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSheet() {
    sheet.classList.remove('create-sheet--open');
    sheet.setAttribute('aria-hidden', 'true');
  }
  function showReelToast() {
    closeSheet();
    const toast = document.querySelector('.reel-toast');
    toast.classList.add('reel-toast--show');
    setTimeout(() => toast.classList.remove('reel-toast--show'), 1400);
  }

  function handleFile() {
    const file = fileInput.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    document.querySelector('.post-editor__image').src = previewUrl;
    document.querySelector('.post-caption__image').src = previewUrl;
    editor.classList.add('post-editor--open');
    editor.setAttribute('aria-hidden', 'false');
  }

  function openCaption() {
    editor.classList.remove('post-editor--open');
    caption.classList.add('post-caption--open');
    caption.setAttribute('aria-hidden', 'false');
  }
  function backToEditor() {
    caption.classList.remove('post-caption--open');
    editor.classList.add('post-editor--open');
  }

  async function publishPost() {
    if (!selectedFile || !db) return;
    const text = document.querySelector('.post-caption__text').value.trim();
    await idbRequest('readwrite', (store) => store.put({
      id: 'my-' + Date.now(),
      imageBlob: selectedFile,
      caption: text,
      likes: 0,
      createdAt: Date.now()
    }));
    resetFlow();
    await refreshPosts();
  }

  function resetFlow() {
    editor.classList.remove('post-editor--open');
    caption.classList.remove('post-caption--open');
    editor.setAttribute('aria-hidden', 'true');
    caption.setAttribute('aria-hidden', 'true');
    document.querySelector('.post-caption__text').value = '';
    fileInput.value = '';
    selectedFile = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  async function refreshPosts() {
    revokeRenderedUrls();
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
    const post = renderedPosts[index];
    setText('.detail-account', me.username);
    setText('.detail-username', me.username);
    setText('.detail-caption__user', me.username);
    setText('.detail-caption__text', post.caption || '');
    setText('.detail-date', post.date || '');
    document.querySelector('.detail-avatar').src = me.avatar;
    document.querySelector('.detail-image').src = post.image;
    detail.classList.add('me-post-detail--open');
    detail.setAttribute('aria-hidden', 'false');
  }
  function closeDetail() {
    detail.classList.remove('me-post-detail--open');
    detail.setAttribute('aria-hidden', 'true');
  }

  function openDb() {
    return new Promise((resolve,reject) => {
      const req = indexedDB.open(DB_NAME,1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE,{keyPath:'id'});
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
  function revokeRenderedUrls() {
    renderedPosts.forEach((p) => {
      if (p.isObjectUrl && p.image) URL.revokeObjectURL(p.image);
    });
  }
  function timeAgo(ts) {
    const minutes = Math.max(1, Math.floor((Date.now()-ts)/60000));
    if (minutes < 60) return minutes + ' 分鐘前';
    const hours = Math.floor(minutes/60);
    if (hours < 24) return hours + ' 小時前';
    return Math.floor(hours/24) + ' 天前';
  }
  function setText(selector,value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }
})();
