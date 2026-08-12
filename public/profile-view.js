(() => {
  const esc = v => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const avatar = url => url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23ddd'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23999'/%3E%3Ccircle cx='40' cy='76' r='25' fill='%23999'/%3E%3C/svg%3E";
  let modal = document.querySelector('#otherUserModal');
  let card;
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'otherUserModal';
    modal.className = 'modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="modalCard otherUserCard"><div class="drawHeader"><h2>User Menu</h2><button id="closeOtherUserModal" type="button">×</button></div><div id="otherUserCard"></div></div>';
    document.body.appendChild(modal);
    const style = document.createElement('style');
    style.textContent = '.otherUserCard{width:min(520px,calc(100vw - 24px));max-height:80vh;overflow:auto}.otherProfileHero{text-align:center;padding:16px}.otherProfileAvatar{width:120px;height:120px;border-radius:50%;object-fit:cover;border:2px solid #ccc;background:#ddd}.otherProfileHero h2{margin:12px 0 4px}.otherProfileStats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.otherProfileNote{text-align:center;margin-top:12px}@media(max-width:600px){.otherProfileStats{grid-template-columns:1fr}.otherProfileAvatar{width:105px;height:105px}}.clickableProfileAvatar{cursor:pointer}.clickableProfileAvatar:hover{filter:brightness(.92)}';
    document.head.appendChild(style);
    modal.querySelector('#closeOtherUserModal').addEventListener('click', () => modal.hidden = true);
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  }
  card = modal.querySelector('#otherUserCard');

  async function openProfile(userId) {
    const id = Number(userId);
    if (!id) return;
    modal.hidden = false;
    card.innerHTML = '<div class="postDate">Loading profile...</div>';
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(id)}`, {cache:'no-store'});
      const u = await r.json();
      if (!r.ok) throw Error(u.error || 'Could not load profile.');
      let posts = [];
      try { const pr = await fetch(`/api/posts?userId=${encodeURIComponent(id)}`, {cache:'no-store'}); if (pr.ok) posts = await pr.json(); } catch {}
      const mine = Array.isArray(posts) ? posts.filter(p => Number(p.user_id) === id) : [];
      const received = mine.reduce((n,p) => n + Number(p.yeahs || 0), 0);
      const given = Array.isArray(posts) ? posts.reduce((n,p) => n + (Number(p.yeahed) === 1 ? 1 : 0), 0) : 0;
      card.innerHTML = `<div class="otherProfileHero"><img class="otherProfileAvatar" src="${esc(avatar(u.avatar))}" alt="${esc(u.name)} profile picture"><h2>${esc(u.name)}</h2><p>Greenverse user #${id}</p></div><div class="otherProfileStats"><div class="stat"><strong>${mine.length}</strong><span>Posts made</span></div><div class="stat"><strong>${received}</strong><span>Yeahs received</span></div><div class="stat"><strong>${given}</strong><span>Yeahs given</span></div></div><p class="postDate otherProfileNote">Public profile information</p>`;
    } catch (e) { card.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  }

  document.addEventListener('click', e => {
    const img = e.target.closest('.postHeader .avatar, .replyAvatar, .notificationAvatar');
    if (!img) return;
    const explicit = img.dataset.userId || img.dataset.actorId;
    if (explicit) { e.preventDefault(); e.stopPropagation(); openProfile(explicit); return; }
    const post = img.closest('[data-post-id]');
    if (post) {
      e.preventDefault(); e.stopPropagation();
      fetch('/api/posts?userId=0',{cache:'no-store'}).then(r=>r.json()).then(posts=>{const p=posts.find(x=>Number(x.id)===Number(post.dataset.postId));if(p)openProfile(p.user_id);}).catch(()=>{});
      return;
    }
    const reply = img.closest('.replyItem');
    if (reply) {
      e.preventDefault(); e.stopPropagation();
      const parent = reply.closest('[data-post-id]');
      const text = reply.querySelector('.replyText')?.textContent || reply.textContent || '';
      if(parent)fetch(`/api/posts/${encodeURIComponent(parent.dataset.postId)}/replies`,{cache:'no-store'}).then(r=>r.json()).then(replies=>{const match=replies.find(x=>text.includes(x.text));if(match)openProfile(match.user_id);}).catch(()=>{});
    }
  }, true);
})();
