(() => {
  const button = document.querySelector('#notificationsButton');
  const modal = document.querySelector('#notificationsModal');
  const list = document.querySelector('#notificationsList');
  const badge = document.querySelector('#notificationBadge');
  const close = document.querySelector('#closeNotifications');
  const markRead = document.querySelector('#markNotificationsRead');
  if (!button || !modal || !list || !badge) return;

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const avatar = url => url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23ddd'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23999'/%3E%3Ccircle cx='40' cy='76' r='25' fill='%23999'/%3E%3C/svg%3E";
  const date = v => { try { return new Date(String(v).replace(' ','T')+'Z').toLocaleString(); } catch { return v || ''; } };
  let loading = false;

  function user() { try { return JSON.parse(localStorage.getItem('miiverseUser') || 'null'); } catch { return null; } }
  function setBadge(count) {
    const n = Number(count || 0);
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('visible', n > 0);
    button.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
  }
  function icon(type) { return type === 'yeah' ? '👍' : type === 'reply' ? '💬' : '🔔'; }

  async function fetchNotifications() {
    const u = user();
    if (!u || !u.id) { setBadge(0); return {notifications:[], unread:0}; }
    const r = await fetch(`/api/notifications?userId=${encodeURIComponent(u.id)}`, {cache:'no-store'});
    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'Could not load notifications.');
    setBadge(data.unread);
    return data;
  }

  function render(data) {
    const rows = Array.isArray(data.notifications) ? data.notifications : [];
    if (!rows.length) {
      list.innerHTML = '<div class="notificationEmpty">You have no notifications yet.</div>';
      return;
    }
    list.innerHTML = rows.map(n => `<button class="notificationItem ${Number(n.read) ? '' : 'unread'}" data-notification-id="${Number(n.id)}" data-post-id="${Number(n.post_id || 0)}" type="button"><img class="notificationAvatar" src="${esc(avatar(n.actor_avatar))}" data-actor-id="${Number(n.actor_id || 0)}" alt=""><span class="notificationBody"><span class="notificationMessage">${icon(n.type)} ${esc(n.message)}</span><span class="notificationDate">${esc(date(n.created_at))}</span></span>${Number(n.read) ? '' : '<span class="notificationDot" aria-label="Unread"></span>'}</button>`).join('');
  }

  async function refresh(open = false) {
    if (loading) return;
    loading = true;
    try {
      const data = await fetchNotifications();
      if (open) render(data);
    } catch (e) {
      console.error('Notifications:', e);
      if (open) list.innerHTML = `<div class="notificationEmpty error">${esc(e.message)}</div>`;
      setBadge(0);
    } finally { loading = false; }
  }

  button.addEventListener('click', async () => {
    modal.hidden = false;
    list.innerHTML = '<div class="notificationEmpty">Loading notifications...</div>';
    await refresh(true);
  });
  close?.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

  markRead?.addEventListener('click', async () => {
    const u = user(); if (!u) return;
    markRead.disabled = true;
    try {
      const r = await fetch('/api/notifications/read', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:u.id})});
      const data = await r.json();
      if (!r.ok) throw Error(data.error || 'Could not mark notifications as read.');
      setBadge(0);
      list.querySelectorAll('.notificationItem.unread').forEach(x => x.classList.remove('unread'));
      list.querySelectorAll('.notificationDot').forEach(x => x.remove());
    } catch (e) { alert(e.message); } finally { markRead.disabled = false; }
  });

  list.addEventListener('click', async e => {
    const item = e.target.closest('.notificationItem');
    if (!item) return;
    const id = Number(item.dataset.notificationId), u = user();
    if (!u) return;
    try {
      await fetch('/api/notifications/read', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:u.id,id})});
      item.classList.remove('unread'); item.querySelector('.notificationDot')?.remove();
      await fetchNotifications();
    } catch {}
  });

  window.refreshNotifications = refresh;
  refresh();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(false); }, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(false); });
  window.addEventListener('storage', e => { if (e.key === 'miiverseUser') refresh(false); });
})();
