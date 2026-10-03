(() => {
  const DATA = window.VISocialData;
  const DIALOGUE = window.VIDialogueData;
  const REL = window.VIRelationships;

  function profile(id) { return DATA.people[id]; }
  function choose(list, salt = 0) {
    if (!list?.length) return '';
    return list[Math.abs(Number(salt || Date.now())) % list.length];
  }

  function context(post = {}) {
    const text = [post.caption, post.location, ...(post.tags || [])]
      .join(' ').toLowerCase();
    if (/咖啡|coffee/.test(text)) return 'coffee';
    if (/音樂|歌|唱片|music/.test(text)) return 'music';
    if (/夜|雨|101|城市/.test(text)) return 'night';
    if (/穿搭|衣|外套|鞋|黑色/.test(text)) return 'fashion';
    if (/餐|吃|夜市|食/.test(text)) return 'food';
    if (post.location) return 'place';
    return 'generic';
  }

  function detectIntent(input = '') {
    const text = String(input).trim().toLowerCase();
    if (/宵夜|消夜|半夜.*吃|夜宵/.test(text)) return 'midnightSnack';
    if (/晚餐|晚飯|晚饭/.test(text)) return 'dinner';
    if (/午餐|午飯|午饭|中午.*吃/.test(text)) return 'lunch';
    if (/早餐|早上.*吃/.test(text)) return 'breakfast';
    if (/吃什麼|吃什么|吃啥|吃飯|吃饭|餓|饿/.test(text)) return 'food';
    if (/在幹嘛|在干嘛|幹嘛呢|干嘛呢|做什麼|做什么|忙什麼|忙什么/.test(text)) return 'whatDoing';
    if (/哪裡|哪里|在哪|位置|地址|哪一站|哪間|哪家/.test(text)) return 'place';
    if (/要不要|一起|約|约|陪我|去嗎|去吗|走嗎|走吗/.test(text)) return 'invite';
    if (/明天/.test(text)) return 'tomorrow';
    if (/幾點|几点|什麼時候|什么时候|今晚|週末|周末|有空/.test(text)) return 'time';
    if (/很煩|很烦|討厭|讨厌|不爽|氣死|气死|累死|受不了/.test(text)) return 'complaint';
    if (/心情|最近怎樣|最近怎样|還好嗎|还好吗|開心|开心|難過|难过|低落/.test(text)) return 'mood';
    if (/工作|上班|下班|加班|讀書|读书|上課|上课|公司|忙嗎|忙吗/.test(text)) return 'work';
    if (/睡了嗎|睡了吗|睡覺|睡觉|睡嗎|睡吗|晚安|失眠/.test(text)) return 'sleep';
    if (/下雨|雨天|淋雨/.test(text)) return 'rain';
    if (/好冷|很冷|冷死|變冷|变冷/.test(text)) return 'cold';
    if (/好熱|好热|很熱|很热|熱死|热死/.test(text)) return 'hot';
    if (/天氣|天气/.test(text)) return 'weather';
    if (/帥|帅|好看|可愛|可爱|喜歡你|喜欢你|很讚|很赞/.test(text)) return 'compliment';
    if (/^(嗨|哈囉|哈喽|hello|hi|早安|早|晚安|欸|喂)/.test(text)) return 'greeting';
    return 'fallback';
  }

  function interestBoost(actor, post) {
    const p = profile(actor);
    if (!p) return 0;
    const hay = [post.caption, post.location, ...(post.tags || [])].join(' ');
    return p.interests.reduce(
      (sum, word) => sum + (hay.includes(word) ? 7 : 0),
      0
    );
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
      return choose(['我再傳你', '下次帶你去', '就在台北啊', '我晚點丟位置'], salt);
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
    const bank = DIALOGUE?.[actor];
    if (!bank) return '嗯嗯';
    const intent = detectIntent(userText);
    return choose(bank[intent] || bank.fallback, salt);
  }

  function actorRanking(target, type, post = {}) {
    const boosts = {};
    Object.keys(DATA.people).forEach((id) => {
      boosts[id] = interestBoost(id, post);
    });
    return REL.rankActors(target, type, boosts);
  }

  window.VISocialEngine = {
    context, detectIntent, interestBoost, comment, reply,
    storyReply, dmOpener, dmReply, actorRanking
  };
})();