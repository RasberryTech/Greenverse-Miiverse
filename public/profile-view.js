(() => {
  const esc = v => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;","`>":"&gt;",'"':"&quot;","'":"&#039;"}[c] || c));
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
        let stats = {posts: 0, yeahs: 0, given: 0};
        try {
          const r = await fetch(`/api/posts?userId=${encodeURIComponent(id)}`, {cache:'no-store'});
          if (r.ok) {
            const posts = await r.json();
            const mine = posts.filter(p => Number(p.user_id) === id);
            stats.posts = mine.length;
            stats.yeahs = mine.reduce((n,p) => n + Number(p.yeahs || 0), 0);
            stats.given = posts.reduce((n,p) => n + (Number(p.yeahed) === 1 ? 1 : 0), 0);
          }
        } catch {}
        card.innerHTML = `<div class="otherProfileHero"><img class="otherProfileAvatar" src="${esc(avatar(u.avatar))}" alt=""><h2>${esc(u.name)}</h2><p>Greenverse user #${Number(u.id)}</p></div><div class="otherProfileStats"><div class="stat"><strong>${stats.posts}</strong><span>Posts made</span></div><div class="stat"><strong>${stats.yeahs}</strong><span>Yeahs received</span></div><div class="stat"><strong>${stats.given}</strong><span>Yeahs given</span></div></div><p class="postDate otherProfileNote">Public profile information</p>`;
      })
      .catch(e => { card.innerHTML = `<div class="error">${esc(e.message)}</div>`; });
  }

  document.addEventListener('click', e => {
    const img = e.target.closest('.postHeader .avatar, .replyAvatar, .notificationAvatar');
    if (!img) return;
    const explicitId = img.dataset.userId || img.dataset.actorId;
    if (explicitId) {
      e.preventDefault(); e.stopPropagation(); openProfile(explicitId); return;
    }
    const post = img.closest('[data-post-id]');
    if (post) {
      fetch(`/api/posts?userId=0`, {cache:'no-store'}).then(r=>r.json()).then(posts=>{
        const p = posts.find(x=>Number(x.id)===Number(post.dataset.postId));
        if (p) openProfile(p.user_id);
      }).catch(()=>{});
      return;
    }
    const reply = img.closest('.replyItem');
    if (reply) {
      const post = reply.closest('[data-post-id]');
      const text = reply.querySelector('.replyText')?.textContent || reply.textContent || '';
      if (post) fetch(`/api/posts/${encodeURIComponent(post.dataset.postId)}/replies`,{cache:'no-store'}).then(r=>r.json()).then(replies=>{
        const match = replies.find(x => text.includes(x.text));
        if (match) openProfile(match.user_id);
      }).catch(()=>{});
    }
  });

  document.querySelector('#closeOtherUserModal')?.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
})();
