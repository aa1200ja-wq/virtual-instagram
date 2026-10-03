(() => {
  const A = window.VIApp;

  function bindNavigation() {
    A.$$('.home-button').forEach((button) => {
      button.onclick = () => A.showView('feed-view');
    });
    A.$$('.me-button').forEach((button) => {
      button.onclick = A.openMe;
    });
    A.$$('.create-button').forEach((button) => {
      button.onclick = () => A.openModal('create-sheet');
    });
    A.$('.back-button').onclick = () => A.showView('feed-view');

    A.$$('.modal-close').forEach((button) => {
      button.onclick = () => {
        button.closest('.modal')?.classList.remove('open');
      };
    });

    A.$$('.toast-button').forEach((button) => {
      button.onclick = () => A.toast(
        button.dataset.toast || '功能預留'
      );
    });
  }

  function bindPostActions() {
    A.$('#follow-button').onclick = A.toggleFollow;
    A.$('#detail-back').onclick = A.closeDetail;
    A.$('#detail-like').onclick = () => {
      const detail = A.state.currentDetail;
      if (!detail) return;
      A.S.toggleLike(detail.id);
      if (!detail.isMine) A.Rel.record('me', detail.ownerId, 'like');
      A.renderDetail(A.postById(detail.id));
      A.renderFeed();
    };
    A.$('#detail-comment').onclick = () => {
      const detail = A.state.currentDetail;
      if (detail) A.openComments(detail.id);
    };
    A.$('#detail-share').onclick = () => {
      if (A.state.currentDetail) {
        A.sharePost(A.state.currentDetail);
      }
    };
    A.$('#detail-repost').onclick = () => {
      A.toast('已模擬轉發');
    };
    A.$('#detail-save').onclick = () => {
      const detail = A.state.currentDetail;
      if (!detail) return;
      A.S.toggleSaved(detail.id);
      A.renderDetail(A.postById(detail.id));
      A.renderFeed();
    };
    A.$('#detail-options').onclick = A.openOptions;
    A.$('#profile-message').onclick = () => {
      if (A.state.currentPersonId) A.DM.open(A.state.currentPersonId);
    };
  }

  function bindForms() {
    A.$('#comment-form').onsubmit = (event) => {
      event.preventDefault();
      const detail = A.state.currentDetail;
      const input = A.$('#comment-input');
      const value = input.value.trim();
      if (!detail || !value) return;
      const reply = A.state.replyingComment;
      A.S.addComment(detail.id, value, reply?.author || '');
      const actor = reply?.ownerId || (!detail.isMine ? detail.ownerId : null);
      if (actor && actor !== 'me') {
        A.Rel.record('me', actor, reply ? 'reply' : 'comment');
        A.W.scheduleCommentReply(detail.id, actor, value);
      }
      input.value = '';
      A.clearCommentReply();
      A.renderComments();
    };

    A.$('#cancel-comment-reply').onclick = A.clearCommentReply;

    A.$('#create-post-choice').onclick = () => {
      A.closeModal('create-sheet');
      A.E.openNew();
    };

    A.$('#edit-profile').onclick = A.openEditProfile;
    A.$('#avatar-add').onclick = A.openEditProfile;
    A.$('#share-profile').onclick = () => {
      const me = A.S.state().me;
      navigator.clipboard?.writeText(
        '@' + me.username + '｜' + me.bio
      );
      A.toast('個人檔案資訊已複製');
    };

    A.$('#profile-form').onsubmit = A.saveProfile;
    A.$('#edit-caption-option').onclick = A.editCaption;
    A.$('#edit-post-option').onclick = A.editFullPost;
    A.$('#delete-post-option').onclick = A.deletePost;
  }

  function bindEvents() {
    window.addEventListener('vi-editor-done', async () => {
      await A.refresh();
      A.openMe();
      A.toast('貼文已更新');
    });
    window.addEventListener('vi-posts-change', A.refresh);

    window.addEventListener('vi-open-post', (event) => {
      const post = A.postById(event.detail?.postId);
      if (post) A.openDetail(post.id, 'feed-view');
    });

    window.addEventListener('vi-open-profile', (event) => {
      if (event.detail?.ownerId) {
        A.openProfile(event.detail.ownerId);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) A.refresh();
    });
  }

  async function init() {
    A.E.init();
    A.DM.init();
    A.Stories.init({
      openProfile: A.openProfile,
      toast: A.toast
    });
    A.Notifications.init();
    bindNavigation();
    bindPostActions();
    bindForms();
    bindEvents();

    await A.refresh();
    A.showView('feed-view');
    setInterval(A.refresh, 15000);
  }

  init();
})();