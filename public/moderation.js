(() => {
  let adminPassword = "";
  const $ = s => document.querySelector(s);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const avatar = u => u || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23ddd'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23999'/%3E%3Ccircle cx='40' cy='76' r='25' fill='%23999'/%3E%3C/svg%3E";
  const date = v => { try { return new Date(v.replace(" ", "T") + "Z").toLocaleString(); } catch { return v; } };
  const user = () => { try { return JSON.parse(localStorage.getItem("miiverseUser") || "null"); } catch { return null; } };
  const adminFetch = (url, options = {}) => { options.headers = { ...(options.headers || {}), "X-Admin-Password": adminPassword }; return fetch(url, options); };

  async function openAdmin() {
    const u = user(); if (!u) return;
    if (!adminPassword) { $("#adminPasswordModal").hidden=false; $("#adminPassword").focus(); return; }
    $("#communitiesNav").classList.remove("active"); $("#userMenuNav").classList.remove("active"); $("#adminNav").classList.add("active"); $("#communityList").hidden=true; $("#communityView").hidden=true; $("#userMenuView").hidden=true; $("#adminView").hidden=false; $("#sectionLabel").textContent="ADMIN"; $("#pageHeading").textContent="Admin Panel";
    const panel=$("#adminPanel"); panel.innerHTML='<div class="profileHero"><h2>Greenverse Admin</h2><p>Loading moderation tools...</p></div>';
    try {
      const [sr,ur,pr]=await Promise.all([adminFetch(`/api/admin/stats?userId=${u.id}`),adminFetch(`/api/admin/users?userId=${u.id}`),adminFetch(`/api/admin/posts?userId=${u.id}`)]);
      const s=await sr.json(), users=await ur.json(), posts=await pr.json();
      if(!sr.ok||!ur.ok||!pr.ok) throw Error(s.error||users.error||posts.error||"Could not load admin data.");
      panel.innerHTML=`<div class="profileHero"><h2>Greenverse Admin</h2><p>Administrator: ${esc(u.name)}</p></div><div class="profileStats adminStats"><div class="stat"><strong>${s.users}</strong><span>Accounts</span></div><div class="stat"><strong>${s.posts}</strong><span>Posts</span></div><div class="stat"><strong>${s.yeahs}</strong><span>Yeahs</span></div><div class="stat"><strong>${s.warnings}</strong><span>Warnings</span></div><div class="stat"><strong>${s.banned}</strong><span>Banned</span></div></div><div class="adminSection"><h2>Account Moderation</h2><div class="adminTable">${users.map(x=>`<div class="adminRow"><div class="adminIdentity"><img class="smallAvatar" src="${avatar(x.avatar)}" alt=""><div><strong>${esc(x.name)}</strong><small>ID ${x.id} · ${x.warning_count} warning${Number(x.warning_count)===1?'':'s'} ${x.banned?'· BANNED':''}</small></div></div><div class="adminActions">${x.id===u.id?'<span class="adminBadge">YOU</span>':`<button class="postButton" data-mod="warn" data-user="${x.id}">Warn</button>${x.banned?`<button class="postButton" data-mod="unban" data-user="${x.id}">Unban</button>`:`<button class="postButton" data-mod="ban" data-user="${x.id}">Ban</button>`}<button class="postButton dangerButton" data-mod="delete-user" data-user="${x.id}" ${Number(x.warning_count)<3?'disabled title="Requires 3 warnings"':''}>Delete Account</button>`}</div></div>`).join('')}</div></div><div class="adminSection"><h2>Post Moderation</h2><div class="adminTable">${posts.map(p=>`<div class="adminRow"><div><strong>${esc(p.name)}</strong><small>${date(p.created_at)} · ${p.yeahs} Yeahs</small><div class="adminPostText">${esc(p.text||'')}${p.image?`<img class="adminPostImage" src="${p.image}" alt="Drawing">`:''}</div></div><button class="postButton dangerButton" data-mod="delete-post" data-post="${p.id}">Delete Post</button></div>`).join('')}</div></div>`;
    } catch(e) { panel.innerHTML=`<div class="profileHero"><h2>Admin Panel</h2><p class="error">${esc(e.message)}</p></div>`; }
  }

  $("#adminPasswordForm").addEventListener("submit",async e=>{e.preventDefault();const u=user(),pw=$("#adminPassword").value,err=$("#adminPasswordError");try{const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:u.id,password:pw})}),d=await r.json();if(!r.ok){err.textContent=d.error||"Incorrect password.";return;}adminPassword=pw;err.textContent="";$("#adminPasswordModal").hidden=true;$("#adminPassword").value="";openAdmin();}catch{err.textContent="Could not connect to the server.";}});
  $("#cancelAdminPassword").onclick=()=>$("#adminPasswordModal").hidden=true;
  $("#adminNav").addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();openAdmin();},true);
  $("#adminPanel").addEventListener("click",async e=>{
    const b=e.target.closest("button[data-mod]"); if(!b)return; const u=user(), action=b.dataset.mod, id=Number(b.dataset.user||0);
    if(action==="warn"){
      const reason=prompt("Warning reason:"); if(reason===null||!reason.trim())return;
      const r=await adminFetch("/api/admin/warnings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({adminId:u.id,userId:id,reason:reason.trim()})}),d=await r.json(); if(!r.ok)return alert(d.error); if(Number(d.warningCount)>=3)alert("This user now has 3 warnings and is eligible for account deletion."); openAdmin();
    } else if(action==="delete-post"){
      if(!confirm("Delete this post?"))return; const r=await adminFetch(`/api/admin/posts/${b.dataset.post}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:u.id})}),d=await r.json(); if(!r.ok)return alert(d.error); openAdmin();
    } else {
      const endpoint=action==="ban"?"/api/admin/ban":action==="unban"?"/api/admin/unban":`/api/admin/users/${id}`;
      if(action==="delete-user"&&!confirm("Delete this account and all of its posts, Yeahs, profile picture, and warnings? This cannot be undone."))return;
      const r=await adminFetch(endpoint,{method:action==="delete-user"?"DELETE":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:id,adminId:u.id})}),d=await r.json(); if(!r.ok)return alert(d.error); openAdmin();
    }
  });
})();
