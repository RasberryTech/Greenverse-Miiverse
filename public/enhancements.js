(() => {
  let drawingData = null;
  let warningsMode = false;
  const $ = s => document.querySelector(s);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const getUser = () => { try { return JSON.parse(localStorage.getItem("miiverseUser") || "null"); } catch { return null; } };
  const formatDate = v => { try { return new Date(v.replace(" ", "T") + "Z").toLocaleString(); } catch { return v; } };
  const warningsTab = $("#warningsTab"), profileTab = $("#profileTab"), profile = $("#userProfile"), warnings = $("#warningsView");

  async function renderWarnings() {
    const u = getUser(); if (!u || !warnings) return;
    profile.hidden = true; warnings.hidden = false; profileTab.classList.remove("active"); warningsTab.classList.add("active");
    try {
      const r = await fetch(`/api/users/${u.id}/warnings?requesterId=${u.id}`), data = await r.json();
      if (!r.ok) throw Error(data.error || "Could not load warnings.");
      warnings.innerHTML = `<div class="profileHero"><h2>Warnings</h2><p>You have ${data.length} warning${data.length === 1 ? "" : "s"}.</p></div>${data.length ? `<div class="warningList">${data.map(w => `<div class="warningCard"><div class="warningTop"><strong>Warning #${w.id}</strong><span>${formatDate(w.created_at)}</span></div><div>${esc(w.reason)}</div><small>Issued by ${esc(w.admin_name)}</small></div>`).join("")}</div>` : '<div class="post"><div class="postText">You have no warnings.</div></div>'}`;
    } catch (e) { warnings.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
  }
  if (warningsTab && profileTab && profile && warnings) {
    warningsTab.addEventListener("click", () => { warningsMode=true; renderWarnings(); });
    profileTab.addEventListener("click", () => { warningsMode=false; profile.hidden=false; warnings.hidden=true; profileTab.classList.add("active"); warningsTab.classList.remove("active"); });
  }

  const drawButton = $("#drawButton"), drawModal = $("#drawModal"), canvas = $("#drawCanvas");
  if (drawButton && drawModal && canvas) {
    const ctx = canvas.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.lineCap="round"; ctx.lineJoin="round";
    let drawing=false;
    const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
    canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
    canvas.addEventListener("pointermove",e=>{if(!drawing)return;const p=point(e);ctx.lineWidth=Number($("#brushSize").value);ctx.strokeStyle="#222";ctx.lineTo(p.x,p.y);ctx.stroke();});
    canvas.addEventListener("pointerup",()=>drawing=false);canvas.addEventListener("pointercancel",()=>drawing=false);
    drawButton.addEventListener("click",()=>drawModal.hidden=false);$("#closeDraw").addEventListener("click",()=>drawModal.hidden=true);
    $("#clearDrawing").addEventListener("click",()=>{ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);});
    $("#saveDrawing").addEventListener("click",()=>{drawingData=canvas.toDataURL("image/png");const preview=$("#drawingPreview");preview.innerHTML=`<img src="${drawingData}" alt="Drawing preview"><button id="removeDrawing" class="postButton" type="button">Remove Drawing</button>`;preview.hidden=false;$("#removeDrawing").onclick=()=>{drawingData=null;preview.hidden=true;preview.innerHTML="";};drawModal.hidden=true;});
    $("#postForm").addEventListener("submit",async e=>{if(!drawingData)return;e.preventDefault();const u=getUser();if(!u)return;const fd=new FormData();fd.append("userId",u.id);fd.append("text",$("#postText").value.trim());const blob=await(await fetch(drawingData)).blob();fd.append("image",blob,"greenverse-drawing.png");const r=await fetch("/api/posts",{method:"POST",body:fd}),d=await r.json();if(!r.ok){alert(d.error||"Could not create post.");return;}$("#postText").value="";drawingData=null;$("#drawingPreview").hidden=true;$("#drawingPreview").innerHTML="";$("#counter").textContent="0 / 500";location.reload();},true);
  }
  setInterval(()=>{if(warningsMode&&$("#userMenuView")&&!$("#userMenuView").hidden)renderWarnings();},1000);
})();
