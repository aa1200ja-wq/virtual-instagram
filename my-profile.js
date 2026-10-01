(function () {
  const data = window.VirtualInstagramData;
  const me = data?.me;
  if (!me) return;

  document.documentElement.classList.toggle(
    'darkTheme',
    localStorage.getItem('theme') === 'dark'
  );

  setText('.me-account__name', me.username);
  setText('.me-display-name', me.displayName);
  setText('.me-bio-text', me.bio || '');
  setText('.me-post-count', me.posts.length.toLocaleString());
  setText('.me-followers', me.followers || '0');
  setText('.me-following', me.following || '0');

  const avatar = document.querySelector('.me-avatar');
  avatar.src = me.avatar;
  avatar.alt = me.username + ' 的大頭貼';

  const grid = document.querySelector('.me-grid');
  const empty = document.querySelector('.me-empty');
  if (!me.posts.length) {
    grid.hidden = true;
    empty.hidden = false;
    return;
  }

  me.posts.forEach((post, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 篇貼文');
    item.innerHTML = '<img src="' + post.image + '" alt="我的貼文" />';
    grid.appendChild(item);
  });

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }
})();
