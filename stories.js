(() => {
  const W = window.VIWorld;
  const R = window.VIEditorRender;
  let options = {};
  let queue = [];
  let current = 0;
  let timer = null;

  const $ = (s, r = document) => r.querySelector(s);
  const ago = (ts) => {
    const m = Math.max(1, Math.floor((Date.now() - Number(ts || Date.now())) / 60000));
    if (m < 60) return m + ' 分鐘前';
    const h = Math.floor(m / 60);
    return h < 24 ? h + ' 小時前' : Math.floor(h / 24) + ' 天前';
  };

  function latestByOwner() {
    const map = new Map();
    W.stories()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((story) => { if (!map.has(story.ownerId)) map.set(story.ownerId, story); });
    return Array.from(map.values());
  }

  function render() {
    const root = $('#stories');
    if (!root) return;
    root.innerHTML = '';
    const list = latestByOwner();
    const mine = list.find((s) => s.mine);
    const me = window.VIStore.state().me;

    const own = document.createElement('button');
    own.className = 'story story-own' + (mine ? ' has-story' : '');
    own.innerHTML =
      '<span class="story-avatar-wrap"><img src="' + me.avatar + '" alt="我的限時動態">' +
      '<b class="story-plus">＋</b></span><span>你的限時</span>';
    own.onclick = () => mine ? openById(mine.id) : $('#story-file').click();
    root.appendChild(own);

    for (const story of list.filter((s) => !s.mine)) {
      const button = document.createElement('button');
      button.className = 'story has-story';
      button.innerHTML =
        '<img src="' + story.avatar + '" alt=""><span>' + story.username + '</span>';
      button.onclick = () => openById(story.id);
      root.appendChild(button);
    }
  }

  function openById(id) {
    queue = W.stories().sort((a, b) => a.createdAt - b.createdAt);
    current = Math.max(0, queue.findIndex((s) => s.id === id));
    showCurrent();
    $('#story-viewer').classList.add('active');
    document.body.classList.add('no-scroll');
  }

  function openOwner(ownerId) {
    const story = W.stories()
      .filter((item) => item.ownerId === ownerId)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (story) openById(story.id);
  }

  function showCurrent() {
    const story = queue[current];
    if (!story) return close();
    $('#story-avatar').src = story.avatar;
    $('#story-username').textContent = story.username;
    $('#story-time').textContent = ago(story.createdAt);
    $('#story-image').src = story.image;
    $('#story-caption').textContent = story.caption || '';
    $('#story-reply-form').classList.toggle('hidden', Boolean(story.mine));
    $('#story-reply-input').value = '';
    $('#story-progress').style.animation = 'none';
    void $('#story-progress').offsetWidth;
    $('#story-progress').style.animation = 'story-progress 5s linear forwards';
    clearTimeout(timer);
    timer = setTimeout(next, 5000);
  }

  function next() {
    if (current < queue.length - 1) {
      current += 1;
      showCurrent();
    } else close();
  }

  function previous() {
    if (current > 0) {
      current -= 1;
      showCurrent();
    }
  }

  function close() {
    clearTimeout(timer);
    $('#story-viewer')?.classList.remove('active');
    document.body.classList.remove('no-scroll');
  }

  async function uploadStory(file) {
    if (!file?.type.startsWith('image/')) return;
    try {
      const image = await R.fileToDataURL(file, 900, .78);
      const caption = prompt('限時動態文字（可以留空）', '') || '';
      W.addMyStory(image, caption);
      render();
      options.toast?.('限時動態已發布');
      const own = W.stories().find((s) => s.mine);
      if (own) openById(own.id);
    } catch {
      options.toast?.('限時動態上傳失敗');
    }
  }

  function bindViewer() {
    $('#story-close').onclick = close;
    $('#story-prev').onclick = (e) => { e.stopPropagation(); previous(); };
    $('#story-next').onclick = (e) => { e.stopPropagation(); next(); };
    $('#story-author').onclick = () => {
      const story = queue[current];
      if (story && !story.mine) {
        close();
        options.openProfile?.(story.ownerId);
      }
    };
    $('#story-file').onchange = async (e) => {
      await uploadStory(e.target.files?.[0]);
      e.target.value = '';
    };

    $('#story-reply-form').onsubmit = (e) => {
      e.preventDefault();
      const story = queue[current];
      const input = $('#story-reply-input');
      if (!story || story.mine || !input.value.trim()) return;
      window.VIDM?.sendStoryReply(story.ownerId, input.value.trim(), story);
      options.toast?.('已回覆限時動態');
      input.value = '';
    };

    document.querySelectorAll('[data-story-reaction]').forEach((button) => {
      button.onclick = () => {
        const story = queue[current];
        if (!story || story.mine) return;
        window.VIDM?.sendStoryReply(
          story.ownerId,
          button.dataset.storyReaction,
          story
        );
        options.toast?.('已傳送表情回應');
      };
    });
  }

  function init(input = {}) {
    options = input;
    bindViewer();
    render();
    window.addEventListener('vi-world-change', render);
    window.addEventListener('vi-state-change', render);
  }

  window.VIStories = { init, render, close, openOwner };
})();