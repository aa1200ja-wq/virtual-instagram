(function () {
  const data = window.VirtualInstagramData;
  if (!data?.characters?.length) return;

  const storageKey = 'virtual-instagram-state-v1';
  const state = loadState();
  const requestedId = new URLSearchParams(location.search).get('id');
  const character =
    data.characters.find((item) => item.id === requestedId) ||
    data.characters.find((item) => item.id === state.viewProfileId) ||
    data.characters.find((item) => item.id === state.activeId) ||
    data.characters[0];
  const modal = document.querySelector('.profile-modal');
  let modalIndex = 0;

  applyTheme();
  renderProfile();
  bindTheme();
  bindFollowButtons();
  bindModal();

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {
        activeId: null,
        likes: {},
        following: {}
      };
    } catch {
      return { activeId: null, likes: {}, following: {} };
    }
  }

  function saveState() {
    state.viewProfileId = character.id;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function applyTheme() {
    document.documentElement.classList.toggle(
      'darkTheme',
      localStorage.getItem('theme') === 'dark'
    );
  }

  function bindTheme() {
    document.querySelector('.profile-topbar__theme')?.addEventListener('click', () => {
      const nextDark = !document.documentElement.classList.contains('darkTheme');
      document.documentElement.classList.toggle('darkTheme', nextDark);
      localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    });
  }

  function renderProfile() {
    setText('.profile-topbar__username', character.username);
    setText('.profile-hero__username', character.username);
    setText('.profile-display-name', character.displayName);
    setText('.profile-bio__text', character.bio || '');
    setText('.profile-stat-posts', character.posts.length.toLocaleString());
    setText('.profile-stat-followers', character.followers || '0');
    setText('.profile-stat-following', character.following || '0');

    const avatar = document.querySelector('.profile-hero__avatar');
    avatar.src = character.avatar;
    avatar.alt = character.username + ' 的大頭貼';

    const grid = document.querySelector('.profile-grid');
    grid.textContent = '';
    character.posts.forEach((post, index) => {
      const button = document.createElement('button');
      button.className = 'profile-grid__item';
      button.type = 'button';
      button.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 篇貼文');
      button.innerHTML =
        '<img src="' + post.image + '" alt="' + character.username + ' 的貼文" />';
      button.addEventListener('click', () => openModal(index));
      grid.appendChild(button);
    });
    syncFollowButtons();
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function isFollowing() {
    return Boolean(state.following?.[character.id]);
  }

  function bindFollowButtons() {
    document.querySelectorAll('[data-follow-button]').forEach((button) => {
      button.addEventListener('click', () => {
        state.following ||= {};
        state.following[character.id] = !isFollowing();
        saveState();
        syncFollowButtons();
      });
    });
  }

  function syncFollowButtons() {
    const followed = isFollowing();
    document.querySelectorAll('[data-follow-button]').forEach((button) => {
      button.textContent = followed ? '追蹤中' : '追蹤';
      button.classList.toggle('profile-action--following', followed);
      button.classList.toggle('profile-action--follow', !followed);
    });
  }

  function bindModal() {
    modal.querySelector('.profile-modal__backdrop').addEventListener('click', closeModal);
    modal.querySelector('.profile-modal__close').addEventListener('click', closeModal);
    modal.querySelector('.profile-modal__like').addEventListener('click', toggleLike);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
  }

  function openModal(index) {
    modalIndex = index;
    const post = character.posts[index];
    modal.querySelector('.profile-modal__image').src = post.image;
    modal.querySelector('.profile-modal__avatar').src = character.avatar;
    modal.querySelector('.profile-modal__username').textContent = character.username;
    modal.querySelector('.profile-modal__caption').textContent = post.caption;
    modal.querySelector('.profile-modal__date').textContent = post.date;
    syncLike();
    modal.classList.add('profile-modal--open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('profile-modal--open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function likeKey() {
    return character.id + ':' + modalIndex;
  }

  function toggleLike() {
    state.likes ||= {};
    state.likes[likeKey()] = !state.likes[likeKey()];
    saveState();
    syncLike();
  }

  function syncLike() {
    const liked = Boolean(state.likes?.[likeKey()]);
    const post = character.posts[modalIndex];
    const heart = modal.querySelector('.profile-modal__heart');
    heart.textContent = liked ? '♥' : '♡';
    heart.classList.toggle('profile-modal__heart--liked', liked);
    modal.querySelector('.profile-modal__likes').textContent =
      (post.likes + (liked ? 1 : 0)).toLocaleString() + ' 個讚';
  }
})();
