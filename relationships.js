(() => {
  const KEY = 'virtual-instagram-rel-v17';
  const DATA = window.VISocialData;
  const NPCS = Object.keys(DATA.people);

  function fresh() {
    return {
      intimacy: { 'kai|me': 42, 'yu|me': 26, 'leo|me': 36, 'kai|yu': 68, 'kai|leo': 24, 'leo|yu': 61 },
      npcFollowing: JSON.parse(JSON.stringify(DATA.npcFollowing)),
      followingMe: [...DATA.followingMe],
      recent: []
    };
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...fresh(), ...raw };
    } catch { return fresh(); }
  }
  let state = load();
  const pairKey = (a, b) => [a, b].sort().join('|');
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function intimacy(a, b) {
    if (a === b) return 100;
    return Number(state.intimacy[pairKey(a, b)] || 15);
  }
  function adjust(a, b, amount) {
    if (a === b) return intimacy(a, b);
    const key = pairKey(a, b);
    state.intimacy[key] = clamp(intimacy(a, b) + Number(amount || 0), 0, 100);
    save();
    return state.intimacy[key];
  }
  function follows(a, b) {
    if (a === 'me' && NPCS.includes(b)) {
      return Boolean(window.VIStore?.state().following?.[b]);
    }
    if (b === 'me' && NPCS.includes(a)) {
      return state.followingMe.includes(a);
    }
    return Boolean(state.npcFollowing[a]?.includes(b));
  }
  function followStrength(a, b) {
    const forward = follows(a, b);
    const reverse = follows(b, a);
    return forward && reverse ? 2 : (forward || reverse ? 1 : 0);
  }
  function label(a, b) {
    const score = intimacy(a, b);
    if (score >= 80) return '很熟';
    if (score >= 55) return '朋友';
    if (score >= 30) return '熟人';
    return '普通';
  }
  function recentPenalty(actor, target, type) {
    const cutoff = Date.now() - 45 * 60000;
    return state.recent.filter((x) =>
      x.at > cutoff && x.actor === actor && x.target === target && x.type === type
    ).length * 18;
  }
  function score(actor, target, type = 'like', contextBoost = 0) {
    const closeness = intimacy(actor, target);
    const forward = follows(actor, target) ? 24 : 0;
    const reverse = follows(target, actor) ? 10 : 0;
    const mutual = followStrength(actor, target) === 2 ? 12 : 0;
    const typeBias = { like: 12, comment: 2, reply: 6, story: 4, dm: -4 }[type] || 0;
    return clamp(18 + closeness * .52 + forward + reverse + mutual + typeBias + contextBoost - recentPenalty(actor, target, type), 0, 100);
  }
  function record(actor, target, type) {
    const gain = { like: 1, comment: 3, reply: 4, story: 4, dm: 5, follow: 8 }[type] || 1;
    adjust(actor, target, gain);
    state.recent.unshift({ actor, target, type, at: Date.now() });
    state.recent = state.recent.slice(0, 60);
    save();
  }
  function rankActors(target, type, contextBoosts = {}) {
    return NPCS.map((actor) => ({
      actor,
      score: score(actor, target, type, Number(contextBoosts[actor] || 0))
    })).sort((a, b) => b.score - a.score);
  }
  function npcFollowsMe(id) { return follows(id, 'me'); }
  function setNpcFollow(actor, target, on = true) {
    state.npcFollowing[actor] ||= [];
    state.npcFollowing[actor] = on
      ? Array.from(new Set([...state.npcFollowing[actor], target]))
      : state.npcFollowing[actor].filter((id) => id !== target);
    save();
  }

  window.VIRelationships = {
    intimacy, adjust, follows, followStrength, label, score, record,
    rankActors, npcFollowsMe, setNpcFollow
  };
})();