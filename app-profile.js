(() => {
  const A = window.VIApp;

  A.openProfile = (id) => {
    const activeView = A.$('.view.active')?.id;
    if (activeView && activeView !== 'profile-view') {
      A.state.profileReturnView = activeView;
    }
    const person = A.S.personById(id);
    if (!person) return;
    A.state.currentPersonId = id;
    const posts = A.S.postsForPerson(id);

    A.$('#profile-header-name').textContent = person.username;
    A.$('#profile-avatar').src = person.avatar;
    A.$('#profile-username').textContent = person.username;
    A.$('#profile-name').textContent = person.name;
    A.$('#profile-bio').textContent = person.bio;
    A.$('#profile-post-count').textContent = posts.length;
    A.$('#profile-followers').textContent = A.follower(
      person.followers + (A.S.isFollowing(id) ? 1 : 0)
    );
    A.$('#profile-following').textContent = A.follower(person.following);
    A.syncFollow();
    A.renderRelationship(id);
    A.renderHighlights(id, posts);

    const grid = A.$('#profile-grid');
    grid.innerHTML = '';
    posts.forEach((post) => {
      const button = document.createElement('button');
      button.innerHTML = '<img src="' + post.images[0] + '" alt="">';
      button.onclick = () => A.openDetail(post.id, 'profile-view');
      grid.appendChild(button);
    });
    A.showView('profile-view');
  };

  A.syncFollow = () => {
    const button = A.$('#follow-button');
    const on = A.S.isFollowing(A.state.currentPersonId);
    button.textContent = on ? '追蹤中' : '追蹤';
    button.classList.toggle('primary', !on);
  };

  A.renderRelationship = (id) => {
    const el = A.$('#relationship-status');
    if (!el || !id) return;
    const score = A.Rel.intimacy('me', id);
    const mine = A.S.isFollowing(id);
    const theirs = A.Rel.follows(id, 'me');
    const followText = mine && theirs
      ? '互相追蹤'
      : theirs
        ? '他有追蹤你'
        : mine
          ? '你已追蹤他'
          : '尚未互相追蹤';
    el.textContent = A.Rel.label('me', id) + ' · 親密度 ' + score + ' · ' + followText;
  };

  A.renderHighlights = (id, posts = []) => {
    const root = A.$('#profile-highlights');
    if (!root) return;
    root.innerHTML = '';
    const labels = ['最近', '日常', '隨手'];
    posts.slice(0, 3).forEach((post, index) => {
      const button = document.createElement('button');
      button.className = 'highlight-button';
      button.innerHTML =
        '<span><img src="' + post.images[0] + '" alt=""></span>' +
        '<small>' + labels[index] + '</small>';
      button.onclick = () => {
        const story = A.W.stories().some((item) => item.ownerId === id);
        if (story) A.Stories.openOwner(id);
        else A.openDetail(post.id, 'profile-view');
      };
      root.appendChild(button);
    });
  };

  A.toggleFollow = () => {
    const id = A.state.currentPersonId;
    if (!id) return;
    const on = A.S.toggleFollow(id);
    if (on) A.Rel.record('me', id, 'follow');
    else A.Rel.adjust('me', id, -2);
    A.openProfile(id);
  };

  A.openMe = () => {
    A.renderMe();
    A.showView('me-view');
  };

  A.renderMe = () => {
    const me = A.S.state().me;
    A.$('#me-header-name').textContent = me.username;
    A.$('#me-username').textContent = me.username;
    A.$('#me-name').textContent = me.name;
    A.$('#me-bio').textContent = me.bio;
    A.$('#me-avatar').src = me.avatar;
    A.$$('.me-avatar-small').forEach((img) => { img.src = me.avatar; });
    A.$('#me-post-count').textContent = A.state.mine.length;
    A.$('#me-followers').textContent = A.W.myFollowerCount();

    const grid = A.$('#me-grid');
    grid.innerHTML = '';
    A.state.mine.forEach((raw) => {
      const post = A.S.makeMine(raw);
      const button = document.createElement('button');
      button.innerHTML = '<img src="' + post.images[0] + '" alt="">';
      button.onclick = () => A.openDetail(post.id, 'me-view');
      grid.appendChild(button);
    });
    A.$('#empty-me').classList.toggle(
      'hidden',
      A.state.mine.length > 0
    );
  };

  A.openEditProfile = () => {
    const me = A.S.state().me;
    A.$('#profile-form-username').value = me.username;
    A.$('#profile-form-name').value = me.name;
    A.$('#profile-form-bio').value = me.bio;
    A.$('#profile-form-avatar').value = '';
    A.openModal('profile-edit-modal');
  };

  A.saveProfile = async (event) => {
    event.preventDefault();
    const patch = {
      username:
        A.$('#profile-form-username').value.trim() ||
        A.S.state().me.username,
      name:
        A.$('#profile-form-name').value.trim() ||
        A.S.state().me.name,
      bio: A.$('#profile-form-bio').value.trim()
    };

    const file = A.$('#profile-form-avatar').files?.[0];
    if (file) {
      patch.avatar = await A.R.fileToDataURL(file, 500, .82);
    }

    A.S.updateMe(patch);
    A.closeModal('profile-edit-modal');
    await A.refresh();
    A.openMe();
    A.toast('個人資料已更新');
  };

  A.openOptions = () => {
    if (A.state.currentDetail?.isMine) {
      A.openModal('post-options-modal');
    }
  };

  A.editCaption = async () => {
    const detail = A.state.currentDetail;
    if (!detail?.isMine) return;

    const next = prompt('編輯貼文文案', detail.caption || '');
    if (next === null) return;

    const raw = A.state.mine.find((post) => post.id === detail.id);
    if (!raw) return;

    raw.caption = next.trim();
    await A.S.putMyPost(raw);
    A.closeModal('post-options-modal');
    await A.refresh();
    A.state.currentDetail = A.postById(raw.id);
    A.renderDetail(A.state.currentDetail);
  };

  A.deletePost = async () => {
    const detail = A.state.currentDetail;
    if (
      !detail?.isMine ||
      !confirm('確定要刪除這篇貼文嗎？')
    ) return;

    await A.S.deleteMyPost(detail.id);
    A.closeModal('post-options-modal');
    A.$('#detail-view').classList.remove('active');
    A.state.currentDetail = null;
    await A.refresh();
    A.openMe();
    A.toast('貼文已刪除');
  };

  A.editFullPost = () => {
    const detail = A.state.currentDetail;
    if (!detail?.isMine) return;
    const raw = A.state.mine.find((post) => post.id === detail.id);

    A.closeModal('post-options-modal');
    A.$('#detail-view').classList.remove('active');
    if (raw) A.E.openExisting(raw);
  };
})();