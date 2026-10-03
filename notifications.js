(() => {
  const W = window.VIWorld;
  const $ = (s, r = document) => r.querySelector(s);

  function ago(ts) {
    const m = Math.max(1, Math.floor((Date.now() - Number(ts || Date.now())) / 60000));
    if (m < 60) return m + ' 分鐘';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' 小時';
    return Math.floor(h / 24) + ' 天';
  }

  function renderBadge() {
    const badge = $('#notification-badge');
    if (!badge) return;
    const count = W.unreadCount();
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.toggle('hidden', count === 0);
  }

  function renderList() {
    const root = $('#notification-list');
    if (!root) return;
    const list = W.notifications();
    root.innerHTML = '';

    if (!list.length) {
      root.innerHTML = '<div class="notification-empty">目前沒有新通知</div>';
      return;
    }

    for (const item of list) {
      const row = document.createElement('button');
      row.className = 'notification-row' + (item.read ? '' : ' unread');
      row.innerHTML =
        '<img src="' + item.avatar + '" alt="">' +
        '<span><strong>' + item.username + '</strong> ' + item.text +
        '<small>' + ago(item.createdAt) + '前</small></span>';
      row.onclick = () => {
        close();
        if (item.type === 'story' && item.ownerId) {
          window.VIDM?.open(item.ownerId);
        } else if (item.postId) {
          window.dispatchEvent(new CustomEvent('vi-open-post', {
            detail: { postId: item.postId }
          }));
        } else if (item.ownerId) {
          window.dispatchEvent(new CustomEvent('vi-open-profile', {
            detail: { ownerId: item.ownerId }
          }));
        }
      };
      root.appendChild(row);
    }
  }

  function render() {
    renderBadge();
    renderList();
  }

  function open() {
    $('#notification-modal')?.classList.add('open');
    W.markNotificationsRead();
    render();
  }

  function close() {
    $('#notification-modal')?.classList.remove('open');
  }

  function init() {
    $('#notifications-button')?.addEventListener('click', open);
    $('#notification-close')?.addEventListener('click', close);
    $('#notification-backdrop')?.addEventListener('click', close);
    window.addEventListener('vi-world-change', render);
    render();
  }

  window.VINotifications = { init, render, open, close };
})();