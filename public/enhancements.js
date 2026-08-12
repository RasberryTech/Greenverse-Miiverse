(() => {
  let drawingData = null;
  let warningsMode = false;
  const $ = s => document.querySelector(s);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const getUser = () => { try { return JSON.parse(localStorage.getItem("miiverseUser") || "null"); } catch { return null; } };
  const formatDate = v => { try { return new Date(v.replace(" ", "T") + "Z").toLocaleString(); } catch { return v; } };

  window.loadPosts = async function loadPosts() {
    const feed = $("#feed"); if (!feed) return;
    const u = getUser();
    try {
      const r = await fetch(`/api/posts?userId=${u ? encodeURIComponent(u.id) : 0}`);
      if (!r.ok) { let d={}; try { d=await r.json(); } catch {} throw Error(d.error || `Could not load posts (HTTP ${r.status}).`); }
      const posts = await r.json();
      if (!posts.length) { feed.innerHTML='<div class="post"><div class="postText">No posts yet. Be the first to post!</div></div>'; return; }
      feed.innerHTML = posts.map(post => `
        <article class="post">
          <div class="postHeader"><img class="avatar" src="${esc(post.avatar || "")}" alt=""><div><b>${esc(post.name)}</b><div class="postDate">${formatDate(post.created_at)}</div></div></div>
          ${post.text ? `<div class="postText">${esc(post.text).replace(/\n/g,"<br>")}</div>` : ""}
          ${post.image ? `<img class="postImage" src="${esc(post.image)}" alt="Post image">` : ""}
          <div class="postActions"><button class="yeahButton ${post.yeahed ? "yeahed" : ""}" data-id="${post.id}" type="button">${post.yeahed ? "♥" : "♡"} Yeah <span class="yeahCount">${Number(post.yeahs || 0)}</span></button></div>
        </article>`).join("");
    } catch (error) { console.error(error); feed.innerHTML=`<div class="post"><div class="postText error">Could not load posts: ${esc(error.message)}</div></div>`; }
  };

  // Yeah toggle: the server stores one Yeah per user/post and toggles it on repeat clicks.
  const feed = $("#feed");
  if (feed) feed.addEventListener("click", async e => {
    const button = e.target.closest(".yeahButton"); if (!button) return;
    const u = getUser(); if (!u) return;
    if (button.disabled) return;
    button.disabled = true;
    try {
      const r = await fetch(`/api/posts/${encodeURIComponent(button.dataset.id)}/yeah`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({userId:u.id}) });
      let d={}; try { d=await r.json(); } catch {}
      if (!r.ok) throw Error(d.error || `Could not Yeah this post (HTTP ${r.status}).`);
      await loadPosts();
    } catch (error) {
      console.error("Yeah failed:", error);
      alert(error.message);
      button.disabled = false;
    }
  });

  // User page: show real post/Yeah statistics whenever the profile is opened.
  async function loadUserStats() {
    const u=getUser(), stats=$("#profileStats"); if(!u||!stats)return;
    try {
      const r=await fetch(`/api/posts?userId=${u.id}`); if(!r.ok)throw Error("Could not load profile statistics.");
      const posts=await r.json();
      const mine=posts.filter(p=>Number(p.user_id)===Number(u.id));
      const received=mine.reduce((n,p)=>n+Number(p.yeahs||0),0);
      const given=posts.reduce((n,p)=>n+(Number(p.yeahed)===1?1:0),0);
      stats.innerHTML=`<div class="stat"><strong>${mine.length}</strong><span>Posts made</span></div><div class="stat"><strong>${received}</strong><span>Yeahs received</span></div><div class="stat"><strong>${given}</strong><span>Yeahs given</span></div>`;
    } catch(e) { console.error(e); }
  }
  const userMenuNav=$("#userMenuNav");
  if(userMenuNav) userMenuNav.addEventListener("click",()=>setTimeout(loadUserStats,50));

  const warningsTab=$("#warningsTab"), profileTab=$("#profileTab"), profile=$("#userProfile"), warnings=$("#warningsView");
  async function renderWarnings() {
    const u=getUser(); if(!u||!warnings)return;
    profile.hidden=true; warnings.hidden=false; profileTab.classList.remove("active"); warningsTab.classList.add("active");
    try {
      const r=await fetch(`/api/users/${u.id}/warnings?requesterId=${u.id}`), data=await r.json();
      if(!r.ok)throw Error(data.error||"Could not load warnings.");
      warnings.innerHTML=`<div class="profileHero"><h2>Warnings</h2><p>You have ${data.length} warning${data.length===1?"":"s"}.</p></div>${data.length?`<div class="warningList">${data.map(w=>`<div class="warningCard"><div class="warningTop"><strong>Warning #${w.id}</strong><span>${formatDate(w.created_at)}</span></div><div>${esc(w.reason)}</div><small>Issued by ${esc(w.admin_name)}</small></div>`).join("")}</div>`:'<div class="post"><div class="postText">You have no warnings.</div></div>'}`;
    } catch(e) { warnings.innerHTML=`<p class="error">${esc(e.message)}</p>`; }
  }
  if(warningsTab&&profileTab&&profile&&warnings){warningsTab.addEventListener("click",()=>{warningsMode=true;renderWarnings();});profileTab.addEventListener("click",()=>{warningsMode=false;profile.hidden=false;warnings.hidden=true;profileTab.classList.add("active");warningsTab.classList.remove("active");loadUserStats();});}

  const drawButton=$("#drawButton"), drawModal=$("#drawModal"), canvas=$("#drawCanvas");
  if(drawButton&&drawModal&&canvas){
    const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.lineCap="round";ctx.lineJoin="round";let drawing=false;
    const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
    canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
    canvas.addEventListener("pointermove",e=>{if(!drawing)return;const p=point(e);ctx.lineWidth=Number($("#brushSize").value);ctx.strokeStyle="#222";ctx.lineTo(p.x,p.y);ctx.stroke();});
    canvas.addEventListener("pointerup",()=>drawing=false);canvas.addEventListener("pointercancel",()=>drawing=false);
    drawButton.addEventListener("click",()=>drawModal.hidden=false);$("#closeDraw").addEventListener("click",()=>drawModal.hidden=true);
    $("#clearDrawing").addEventListener("click",()=>{ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);});
    $("#saveDrawing").addEventListener("click",()=>{drawingData=canvas.toDataURL("image/png");const preview=$("#drawingPreview");preview.innerHTML=`<img src="${drawingData}" alt="Drawing preview"><button id="removeDrawing" class="postButton" type="button">Remove Drawing</button>`;preview.hidden=false;$("#removeDrawing").onclick=()=>{drawingData=null;preview.hidden=true;preview.innerHTML="";};drawModal.hidden=true;});
    $("#postForm").addEventListener("submit",async e=>{if(!drawingData)return;e.preventDefault();const u=getUser();if(!u)return;const fd=new FormData();fd.append("userId",u.id);fd.append("text",$("#postText").value.trim());const blob=await(await fetch(drawingData)).blob();fd.append("image",blob,"greenverse-drawing.png");const r=await fetch("/api/posts",{method:"POST",body:fd}),d=await r.json();if(!r.ok){alert(d.error||"Could not create post.");return;}$("#postText").value="";drawingData=null;$("#drawingPreview").hidden=true;$("#drawingPreview").innerHTML="";$("#counter").textContent="0 / 500";await loadPosts();},true);
  }
})();
