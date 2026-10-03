(() => {
  const A = window.VIApp;

  A.renderFeed = () => {
    const root = A.$('#feed');
    root.innerHTML = '';
    A.state.feed.forEach((post) => {
      const article = document.createElement('article');
      article.className = 'post';

      const head = document.createElement('div');
      head.className = 'post-head';
      head.innerHTML =
        '<img src="' + post.avatar + '" alt="">' +
        '<div><button class="post-user">' + A.esc(post.username) + '</button>' +
        (post.location ? '<small>' + A.esc(post.location) + '</small>' : '') +
        '</div>';
      head.querySelector('img').onclick = () => A.openOwner(post.ownerId);
      head.querySelector('.post-user').onclick = () => A.openOwner(post.ownerId);

      const actions = document.createElement('div');
      actions.className = 'post-actions';
      const like = document.createElement('button');
      like.className = A.S.isLiked(post.id) ? 'liked' : '';
      like.textContent = A.S.isLiked(post.id) ? '♥' : '♡';
      like.onclick = () => {
        A.S.toggleLike(post.id);
        if (!post.isMine) A.Rel.record('me', post.ownerId, 'like');
        A.renderFeed();
      };

      const share = document.createElement('button');
      share.textContent = '⌁';
      share.onclick = () => A.sharePost(post);
      actions.append(like, A.commentButton(post.id), share, A.bookmarkButton(post));

      const meta = document.createElement('div');
      meta.innerHTML =
        '<div class="post-likes">' +
        A.likeCount(post).toLocaleString('zh-TW') + ' 個讚</div>' +
        '<div class="post-caption"><strong>' +
        A.esc(post.username) + '</strong> ' +
        A.esc(post.caption || '') + '</div>' +
        (post.tags?.length
          ? '<div class="post-tags">標註 ' + post.tags.map(A.esc).join('、') + '</div>'
          : '') +
        '<div class="post-time">' + A.ago(post.createdAt) + '</div>';

      article.append(
        head,
        A.media(post, () => A.openDetail(post.id, 'feed-view')),
        actions,
        meta
      );
      root.appendChild(article);
    });
  };

  A.openOwner = (id) => id === 'me' ? A.openMe() : A.openProfile(id);

  A.openDetail = (id, from) => {
    const post = A.postById(id);
    if (!post) return;
    A.state.currentDetail = post;
    A.state.returnView = from || 'feed-view';
    A.renderDetail(post);
    A.$('#detail-view').classList.add('active');
  };

  A.renderDetail = (post) => {
    if (!post) return;
    A.state.currentDetail = post;
    A.$('#detail-subtitle').textContent = post.username;
    A.$('#detail-avatar').src = post.avatar;
    A.$('#detail-user').textContent = post.username;
    A.$('#detail-location').textContent = post.location || '';
    A.$('#detail-caption-user').textContent = post.username;
    A.$('#detail-caption').textContent = post.caption || '';
    A.$('#detail-tags').textContent =
      post.tags?.length ? '標註 ' + post.tags.join('、') : '';
    A.$('#detail-time').textContent = A.ago(post.createdAt);
    A.$('#detail-likes').textContent =
      A.likeCount(post).toLocaleString('zh-TW') + ' 個讚';

    const heart = A.$('#detail-like');
    heart.textContent = A.S.isLiked(post.id) ? '♥' : '♡';
    heart.classList.toggle('liked', A.S.isLiked(post.id));
    const saved = A.$('#detail-save');
    saved.classList.toggle('saved', A.S.isSaved(post.id));
    saved.innerHTML = '<span></span>';
    A.$('#detail-options').style.visibility = post.isMine ? 'visible' : 'hidden';

    const mediaRoot = A.$('#detail-media');
    mediaRoot.innerHTML = '';
    mediaRoot.appendChild(A.media(post, null));
  };

  A.closeDetail = () => {
    A.$('#detail-view').classList.remove('active');
    if (A.state.returnView === 'me-view') A.openMe();
    else if (A.state.returnView === 'profile-view' && A.state.currentPersonId) {
      A.openProfile(A.state.currentPersonId);
    } else if (A.state.returnView === 'explore-view') {
      A.showView('explore-view');
    } else A.showView('feed-view');
  };

  A.openComments = (id) => {
    A.state.currentDetail = A.postById(id);
    A.clearCommentReply();
    A.renderComments();
    A.openModal('comments-modal');
    setTimeout(() => A.$('#comment-input').focus(), 50);
  };

  A.setCommentReply = (comment) => {
    A.state.replyingComment = comment;
    const bar = A.$('#comment-replying');
    bar.classList.remove('hidden');
    bar.querySelector('span').textContent = '回覆 @' + comment.author;
    A.$('#comment-input').placeholder = '回覆 @' + comment.author + '…';
    A.$('#comment-input').focus();
  };

  A.clearCommentReply = () => {
    A.state.replyingComment = null;
    A.$('#comment-replying')?.classList.add('hidden');
    if (A.$('#comment-input')) A.$('#comment-input').placeholder = '新增留言…';
  };

  A.renderComments = () => {
    const root = A.$('#comments-list');
    const postId = A.state.currentDetail?.id;
    const local = A.S.comments(postId);
    const world = A.W.comments(postId);
    const list = [...world, ...local].sort((a, b) => a.createdAt - b.createdAt);

    root.innerHTML = '';
    if (!list.length) {
      root.innerHTML = '<div class="empty-comment">還沒有留言</div>';
      return;
    }

    list.forEach((comment) => {
      const row = document.createElement('div');
      row.className = 'comment-row';
      const avatar = comment.avatar || A.S.state().me.avatar;
      const replyMeta = comment.replyTo
        ? '<small class="reply-meta">回覆 @' + A.esc(comment.replyTo) + '</small>'
        : '';
      row.innerHTML =
        '<img src="' + avatar + '" alt=""><div><strong>' +
        A.esc(comment.author) + '</strong>' + replyMeta + '<p>' +
        A.esc(comment.text) + '</p><small>' +
        A.ago(comment.createdAt) + '</small>' +
        '<div class="comment-tools"><button data-like>' +
        (comment.liked ? '♥' : '♡') + '</button>' +
        (!comment.mine ? '<button data-reply>回覆</button>' : '') +
        (comment.mine ? '<button data-delete>刪除</button>' : '') +
        '</div></div>';

      row.querySelector('[data-like]').onclick = () => {
        if (comment.world) A.W.toggleCommentLike(postId, comment.id);
        else A.S.toggleCommentLike(postId, comment.id);
        A.renderComments();
      };
      row.querySelector('[data-reply]')?.addEventListener('click', () => {
        A.setCommentReply(comment);
      });
      row.querySelector('[data-delete]')?.addEventListener('click', () => {
        A.S.deleteComment(postId, comment.id);
        A.renderComments();
      });
      root.appendChild(row);
    });
  };
})();