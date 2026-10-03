(() => {
  const A = window.VIApp;

  function matches(value, query) {
    return String(value || '')
      .toLowerCase()
      .includes(query);
  }

  A.renderExplore = (query = '') => {
    const root = A.$('#explore-grid');
    const peopleRoot = A.$('#explore-people');
    if (!root || !peopleRoot) return;

    const q = String(query || '').trim().toLowerCase();
    const people = A.D.people.filter((person) =>
      !q ||
      matches(person.username, q) ||
      matches(person.name, q) ||
      matches(person.bio, q)
    );

    peopleRoot.innerHTML = '';
    people.forEach((person) => {
      const card = document.createElement('button');
      card.className = 'explore-person';
      card.innerHTML =
        '<img src="' + person.avatar + '" alt="">' +
        '<span><strong>' + A.esc(person.username) + '</strong>' +
        '<small>' + A.esc(person.name) + '</small></span>';
      card.onclick = () => A.openProfile(person.id);
      peopleRoot.appendChild(card);
    });
    peopleRoot.classList.toggle('hidden', !people.length);

    const posts = A.state.feed
      .filter((post) => !post.isMine)
      .filter((post) => {
        if (!q) return true;
        const owner = A.S.personById(post.ownerId);
        return [
          post.username,
          post.caption,
          post.location,
          ...(post.tags || []),
          owner?.name,
          owner?.bio
        ].some((value) => matches(value, q));
      });

    root.innerHTML = '';
    posts.forEach((post) => {
      const button = document.createElement('button');
      button.className = 'explore-tile';
      button.innerHTML =
        '<img src="' + post.images[0] + '" alt="">' +
        (post.images.length > 1 ? '<span>▣</span>' : '');
      button.onclick = () =>
        A.openDetail(post.id, 'explore-view');
      root.appendChild(button);
    });

    A.$('#explore-empty').classList.toggle(
      'hidden',
      people.length > 0 || posts.length > 0
    );
  };

  A.openExplore = () => {
    const input = A.$('#explore-search');
    A.renderExplore(input?.value || '');
    A.showView('explore-view');
    setTimeout(() => input?.focus(), 50);
  };

  A.initExplore = () => {
    const input = A.$('#explore-search');
    input?.addEventListener('input', (event) => {
      A.renderExplore(event.target.value);
    });

    A.$$('.explore-button').forEach((button) => {
      button.onclick = A.openExplore;
    });
  };
})();