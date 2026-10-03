(() => {
  const DATA = window.VISocialData;
  const REL = window.VIRelationships;

  function profile(id) { return DATA.people[id]; }
  function choose(list, salt = 0) {
    if (!list?.length) return '';
    return list[Math.abs(Number(salt || Date.now())) % list.length];
  }
  function context(post = {}) {
    const text = [post.caption, post.location, ...(post.tags || [])].join(' ').toLowerCase();
    if (/咖啡|coffee/.test(text)) return 'coffee';
    if (/音樂|歌|唱片|music/.test(text)) return 'music';
    if (/夜|雨|101|城市/.test(text)) return 'night';
    if (/穿搭|衣|外套|鞋|黑色/.test(text)) return 'fashion';
    if (/餐|吃|夜市|食/.test(text)) return 'food';
    if (post.location) return 'place';
    return 'generic';
  }
  function interestBoost(actor, post) {
    const p = profile(actor);
    if (!p) return 0;
    const hay = [post.caption, post.location, ...(post.tags || [])].join(' ');
    return p.interests.reduce((sum, word) => sum + (hay.includes(word) ? 7 : 0), 0);
  }
  function comment(actor, post, salt = 0) {
    const p = profile(actor);
    if (!p) return '好看';
    const key = context(post);
    return choose(p.comments[key] || p.comments.generic, salt);
  }
  function reply(actor, parentText = '', salt = 0) {
    const p = profile(actor);
    if (!p) return '哈哈';
    if (/哪|哪裡|哪里|地址/.test(parentText)) {
      const options = ['我再傳你', '下次帶你去', '就在台北啊', '我晚點丟位置'];
      return choose(options, salt);
    }
    if (/一起|約|下次/.test(parentText)) {
      return choose(['可以啊', '好，下次約', '你說的喔', '有空就去'], salt);
    }
    return choose(p.replies, salt);
  }
  function storyReply(actor, salt = 0) {
    return choose(profile(actor)?.storyReplies || ['好看'], salt);
  }
  function dmOpener(actor, salt = 0) {
    return choose(profile(actor)?.dmOpeners || ['在幹嘛'], salt);
  }
  function dmReply(actor, userText = '', salt = 0) {
    if (/哪|哪裡|哪里/.test(userText)) return choose(['台北啊', '我再傳位置給你', '你不是去過 😂'], salt);
    if (/好|可以|約/.test(userText)) return choose(['可以啊', '那就這樣', '你說的喔'], salt);
    return choose(profile(actor)?.dmReplies || ['哈哈'], salt);
  }
  function actorRanking(target, type, post = {}) {
    const boosts = {};
    Object.keys(DATA.people).forEach((id) => { boosts[id] = interestBoost(id, post); });
    return REL.rankActors(target, type, boosts);
  }

  window.VISocialEngine = {
    context, interestBoost, comment, reply,
    storyReply, dmOpener, dmReply, actorRanking
  };
})();