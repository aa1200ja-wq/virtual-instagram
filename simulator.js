(function () {
  const data = window.VirtualInstagramData;
  if (!data || !Array.isArray(data.characters)) return;

  const stories = Array.from(document.querySelectorAll('.story'));
  const posts = Array.from(document.querySelectorAll('.post'));
  const storageKey = 'virtual-instagram-state-v1';
  const state = loadState();
  let active = data.characters.find((item) => item.id === state.activeId) || data.characters[0];

  removeUnusedPanels();
  setupStories();
  setupProfileNavigation();
  setupPosts();
  createPostModal();
  render();

  function removeUnusedPanels() {
    document.querySelector('.header__search')?.remove();
    document.querySelector('.side-menu')?.remove();
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || { activeId: null, likes: {} };
    } catch {
      return { activeId: null, likes: {} };
    }
  }

  function saveState() {
    state.activeId = active.id;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function setupStories() {
    stories.forEach((story, index) => {
      const character = data.characters[index];
      if (!character) {
        story.hidden = true;
        return;
      }
      story.dataset.characterId = character.id;
      const image = story.querySelector('img');
      const label = story.querySelector('.story__user');
      if (image) image.src = character.avatar;
      if (label) label.textContent = character.username;
      story.addEventListener('click', () => {
        active = character;
        saveState();
        render();
      });
    });
  }

  function setupProfileNavigation() {
    document.querySelectorAll('.profile-button').forEach((button) => {
      button.setAttribute('aria-label', '查看個人頁');
      button.addEventListener('click', () => {
        saveState();
        window.location.href = 'profile.html';
      });
    });
  }

  function setupPosts() {
    posts.forEach((post, index) => {
      post.dataset.postIndex = String(index);
      const likeButton = post.querySelector('.post__buttons .post__button');
      if (likeButton) {
        likeButton.classList.add('sim-like-button');
        likeButton.setAttribute('aria-label', '按讚');
        likeButton._simOutlineIcon = likeButton.innerHTML;
        likeButton.addEventListener('click', () => toggleLike(index));
      }
      post.querySelectorAll('.post__avatar, .post__user').forEach((link) => {
        link.setAttribute('href', '#');
        link.removeAttribute('target');
        link.addEventListener('click', (event) => event.preventDefault());
      });
      post.querySelectorAll('.post__media').forEach((media) => {
        media.classList.add('sim-open-post');
        media.addEventListener('click', () => openPostModal(index, media.src));
        media.addEventListener('dblclick', () => toggleLike(index));
      });
    });
  }

  function render() {
    document.querySelectorAll('.profile-button__picture img').forEach((img) => {
      img.src = active.avatar;
      img.alt = active.username + ' 的大頭貼';
    });

    stories.forEach((story) => {
      story.classList.toggle('story--selected', story.dataset.characterId === active.id);
    });

    posts.forEach((post, index) => {
      const postData = active.posts[index % active.posts.length];
      post.querySelectorAll('.post__avatar img, .post__likes-avatar img').forEach((img) => {
        img.src = active.avatar;
      });
      post.querySelectorAll('.post__user').forEach((node) => {
        node.textContent = active.username;
        node.removeAttribute('target');
        node.setAttribute('href', '#');
      });

      const description = post.querySelector('.post__description span');
      if (description) {
        description.textContent = '';
        const username = document.createElement('a');
        username.className = 'post__name--underline';
        username.href = '#';
        username.textContent = active.username;
        description.append(username, document.createTextNode(' ' + postData.caption));
      }

      const date = post.querySelector('.post__date-time');
      if (date) date.textContent = postData.date;

      post.querySelectorAll('.post__media').forEach((media) => {
        media.src = postData.image;
        media.alt = active.username + ' 的貼文';
      });

      updateLikeUI(post, index, postData.likes);
    });

    const modal = document.querySelector('.sim-modal');
    if (modal && modal.classList.contains('sim-modal--open')) {
      const index = Number(modal.dataset.postIndex || 0);
      syncModal(index);
    }
  }

  function likeKey(index) {
    return active.id + ':' + index;
  }

  function isLiked(index) {
    return Boolean(state.likes && state.likes[likeKey(index)]);
  }

  function toggleLike(index) {
    state.likes ||= {};
    const key = likeKey(index);
    state.likes[key] = !state.likes[key];
    saveState();
    const post = posts[index];
    const postData = active.posts[index % active.posts.length];
    updateLikeUI(post, index, postData.likes);
    syncModal(index);
  }

  function updateLikeUI(post, index, baseLikes) {
    const liked = isLiked(index);
    const button = post.querySelector('.sim-like-button');
    if (button) {
      button.classList.toggle('sim-liked', liked);
      button.innerHTML = liked ? solidHeartIcon() : button._simOutlineIcon;
    }
    const likes = post.querySelector('.post__likes span');
    if (likes) likes.textContent = (baseLikes + (liked ? 1 : 0)).toLocaleString() + ' 個讚';
  }

  function createPostModal() {
    const modal = document.createElement('div');
    modal.className = 'sim-modal';
    modal.innerHTML = `
      <button class="sim-modal__backdrop" aria-label="關閉貼文"></button>
      <section class="sim-modal__panel" role="dialog" aria-modal="true">
        <button class="sim-modal__close" aria-label="關閉貼文">×</button>
        <img class="sim-modal__image" alt="貼文預覽" />
        <div class="sim-modal__body">
          <div class="sim-modal__user">
            <img class="sim-modal__avatar" alt="" />
            <strong class="sim-modal__username"></strong>
          </div>
          <p class="sim-modal__caption"></p>
          <button class="sim-modal__like" type="button">♡ <span></span></button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.sim-modal__backdrop').addEventListener('click', closeModal);
    modal.querySelector('.sim-modal__close').addEventListener('click', closeModal);
    modal.querySelector('.sim-modal__like').addEventListener('click', () => {
      toggleLike(Number(modal.dataset.postIndex || 0));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
  }

  function openPostModal(index, imageSrc) {
    const modal = document.querySelector('.sim-modal');
    modal.dataset.postIndex = String(index);
    modal.querySelector('.sim-modal__image').src = imageSrc;
    modal.classList.add('sim-modal--open');
    document.body.classList.add('sim-modal-open');
    syncModal(index);
  }

  function syncModal(index) {
    const modal = document.querySelector('.sim-modal');
    if (!modal || !modal.classList.contains('sim-modal--open')) return;
    const postData = active.posts[index % active.posts.length];
    modal.querySelector('.sim-modal__avatar').src = active.avatar;
    modal.querySelector('.sim-modal__username').textContent = active.username;
    modal.querySelector('.sim-modal__caption').textContent = postData.caption;
    const like = modal.querySelector('.sim-modal__like');
    const liked = isLiked(index);
    like.classList.toggle('sim-liked', liked);
    like.firstChild.textContent = liked ? '♥ ' : '♡ ';
    like.querySelector('span').textContent = (postData.likes + (liked ? 1 : 0)).toLocaleString();
  }

  function solidHeartIcon() {
    return `
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="var(--like)"
        />
      </svg>
    `;
  }

  function closeModal() {
    const modal = document.querySelector('.sim-modal');
    if (!modal) return;
    modal.classList.remove('sim-modal--open');
    document.body.classList.remove('sim-modal-open');
  }
})();
