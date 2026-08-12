(() => {
  const esc = v => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const avatar = url => url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23ddd'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23999'/%3E%3Ccircle cx='40' cy='76' r='25' fill='%23999'/%3E%3C/svg%3E";
  const modal = document.querySelector('#otherUserModal');
  const card = document.querySelector('#otherUserCard');
  if (!modal || !card) return;

  function openProfile(userId) {
    const id = Number(userId);
    if (!id) return;
    card.innerHTML = '<div class="postDate">Loading profile...</div>';
    modal.hidden = false;
    fetch(`/api/users/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw Error(d.error || 'Could not load profile.'); return d; })
      .then(async u => {
        let stats = {posts: 0, yeahs: 0};
        try {
          const r = await fetch(`/api/posts?userId=${encodeURIComponent(id)}`, {cache:'no-store'});
          if (r.ok) {
            const posts = await r.json();
            const mine = posts.filter(p => Number(p.user_id) === id);
            stats.posts = mine.length;
            stats.yeahs = mine.reduce((n,p) => n + Number(p.yeahs || 0), 0);
          }
        } catch {}
        const me = JSON.parse(localStorage.getItem('miiverseUser') || 'null');
        const self = me && Number(me.id) === id;
        card.innerHTML = `<div class="otherProfileHero"><img class="otherProfileAvatar" src="${esc(avatar(u.avatar))}" alt=""><h2>${esc(u.name)}</h2><p>Greenverse user #${Number(u.id)}</p></div><div class="otherProfileStats"><div class="stat"><strong>${stats.posts}</strong><span>Posts made</span></div><div class="stat"><strong>${stats.yeahs}</strong><span>Yeahs received</span></div></div>${self ? '<p class="postDate otherProfileNote">This is your profile.</p>' : '<p class="postDate otherProfileNote">Public profile information</p>'}`;
      })
      .catch(e => { card.innerHTML = `<div class="error">${esc(e.message)}</div>`; });
  }

  document.addEventListener('click', e => {
    const img = e.target.closest('.postHeader .avatar, .replyAvatar, .notificationAvatar');
    if (!img) return;
    const post = img.closest('[data-post-id]');
    const reply = img.closest('.replyItem');
    const notification = img.closest('.notificationItem');
    let id = img.dataset.userId;
    if (!id && post) {
      const name = post.querySelector('.postHeader b')?.textContent;
      // Fetch the post so we can identify its owner without trusting display text.
      fetch(`/api/posts?userId=0`, {cache:'no-store'}).then(r=>r.json()).then(posts => {
        const p = posts.find(x => Number(x.id) === Number(post.dataset.postId));
        if (p) openProfile(p.user_id);
      }).catch(() => {});
      return;
    }
    if (!id && reply) {
      // Reply avatars are tagged by enhancements.js below when replies are loaded.
      id = reply.dataset.userId;
    }
    if (!id && notification) id = notification.dataset.actorId;
    if (id) openProfile(id);
  });

  document.querySelector('#closeOtherUserModal')?.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
})();
