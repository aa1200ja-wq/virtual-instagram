(() => {
  const App = {
    D: window.VirtualInstagramData,
    S: window.VIStore,
    E: window.VIEditor,
    R: window.VIEditorRender,
    W: window.VIWorld,
    Rel: window.VIRelationships,
    Social: window.VISocialEngine,
    DM: window.VIDM,
    Stories: window.VIStories,
    Notifications: window.VINotifications,
    state: {
      feed: [],
      mine: [],
      currentPersonId: null,
      currentDetail: null,
      replyingComment: null,
      profileReturnView: 'feed-view',
      returnView: 'feed-view'
    }
  };

  App.$ = (selector, root = document) => root.querySelector(selector);
  App.$$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  App.esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    "'": '&#39;', '"': '&quot;'
  }[c]));

  App.ago = (timestamp) => {
    const minutes = Math.max(
      1,
      Math.floor((Date.now() - Number(timestamp || Date.now())) / 60000)
    );
    if (minutes < 60) return minutes + ' 分鐘前';
    const hours = Math.floor(minutes / 60);
    return hours < 24
      ? hours + ' 小時前'
      : Math.floor(hours / 24) + ' 天前';
  };

  App.follower = (value) => Number(value) >= 10000
    ? (Number(value) / 10000).toFixed(1).replace('.0', '') + ' 萬'
    : Number(value || 0).toLocaleString('zh-TW');

  App.postById = (id) =>
    App.state.feed.find((post) => post.id === id) || null;

  App.likeCount = (post) =>
    Number(post.likes || 0) +
    (App.S.isLiked(post.id) ? 1 : 0) +
    App.W.likeDelta(post.id);

  App.toast = (text) => {
    const el = App.$('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(App.toast.timer);
    App.toast.timer = setTimeout(() => el.classList.remove('show'), 1600);
  };

  App.showView = (id) => {
    App.$$('.view').forEach((view) => view.classList.remove('active'));
    App.$('#' + id)?.classList.add('active');
    App.S.state().lastView = id;
    App.S.save();
    scrollTo({ top: 0, behavior: 'instant' });
  };

  App.openModal = (id) => App.$('#' + id)?.classList.add('open');
  App.closeModal = (id) => App.$('#' + id)?.classList.remove('open');

  App.refresh = async () => {
    App.state.mine = await App.S.getMyPosts();
    await App.W.tick(App.state.mine);
    App.state.feed = await App.S.feedPosts();
    App.renderFeed?.();
    App.renderMe?.();
    App.renderExplore?.(App.$('#explore-search')?.value || '');
    App.Notifications.render();
  };

  App.media = (post, onOpen) => {
    const box = document.createElement('div');
    box.className = 'carousel';
    const images = post.images?.length ? post.images : [post.image];
    let index = 0;

    const img = document.createElement('img');
    img.className = 'post-media';
    img.alt = post.username + ' 的貼文';
    const dots = document.createElement('div');
    dots.className = 'carousel-dots';

    const sync = () => {
      img.src = images[index];
      dots.innerHTML = images.map((_, i) =>
        '<span class="' + (i === index ? 'active' : '') + '"></span>'
      ).join('');
    };

    img.onclick = () => onOpen?.();
    img.ondblclick = (event) => {
      event.stopPropagation();
      App.S.toggleLike(post.id);
      App.renderFeed?.();
      if (App.state.currentDetail?.id === post.id) {
        App.renderDetail?.(App.postById(post.id));
      }
    };
    box.appendChild(img);

    if (images.length > 1) {
      const prev = document.createElement('button');
      const next = document.createElement('button');
      prev.className = 'carousel-arrow prev';
      next.className = 'carousel-arrow next';
      prev.textContent = '‹';
      next.textContent = '›';

      prev.onclick = (event) => {
        event.stopPropagation();
        index = (index - 1 + images.length) % images.length;
        sync();
      };
      next.onclick = (event) => {
        event.stopPropagation();
        index = (index + 1) % images.length;
        sync();
      };
      box.append(prev, next, dots);
    }

    sync();
    return box;
  };

  App.commentButton = (id) => {
    const button = document.createElement('button');
    button.className = 'comment-icon';
    button.innerHTML = '<span></span>';
    button.onclick = () => App.openComments?.(id);
    return button;
  };

  App.bookmarkButton = (post) => {
    const button = document.createElement('button');
    button.className =
      'bookmark' + (App.S.isSaved(post.id) ? ' saved' : '');
    button.setAttribute('aria-label', '收藏');
    button.innerHTML = '<span></span>';

    button.onclick = () => {
      App.S.toggleSaved(post.id);
      App.renderFeed?.();
      if (App.state.currentDetail?.id === post.id) {
        App.renderDetail?.(App.postById(post.id));
      }
    };
    return button;
  };

  App.sharePost = async (post) => {
    const text = post.username + '：' + (post.caption || '');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'IG 模擬器貼文', text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        App.toast('貼文內容已複製');
      }
    } catch {}
  };

  window.VIApp = App;
})();