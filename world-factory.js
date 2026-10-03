(() => {
  const PEOPLE = window.VirtualInstagramData.people;
  const CONTENT = window.VISocialData.world;
  const choose = (list, n) =>
    list[Math.abs(Number(n || 0)) % list.length];

  function person(id) {
    return PEOPLE.find((p) => p.id === id);
  }

  function makeStory(ownerId, createdAt, nextIndex) {
    const p = person(ownerId);
    if (!p) return null;
    const n = nextIndex();
    return {
      id: 'story-' + ownerId + '-' + createdAt,
      ownerId,
      username: p.username,
      avatar: p.avatar,
      image: choose(CONTENT[ownerId].images, n),
      caption: choose(CONTENT[ownerId].stories, n),
      createdAt,
      expiresAt: createdAt + 86400000,
      mine: false
    };
  }

  function makePost(ownerId, createdAt, nextIndex) {
    const p = person(ownerId);
    if (!p) return null;
    const n = nextIndex();
    const image = choose(CONTENT[ownerId].images, n);
    return {
      id: 'world-' + ownerId + '-' + createdAt,
      ownerId,
      username: p.username,
      name: p.name,
      avatar: p.avatar,
      images: [image],
      image,
      caption: choose(CONTENT[ownerId].posts, n),
      location: n % 2 ? '台北' : '',
      tags: [],
      likes: 300 + (n * 137) % 2600,
      createdAt,
      isMine: false,
      generated: true
    };
  }

  window.VIWorldFactory = { makeStory, makePost };
})();