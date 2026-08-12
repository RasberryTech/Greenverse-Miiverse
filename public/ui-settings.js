(() => {
  const KEY = 'greenverse-ui-mode';

  function mode() {
    return localStorage.getItem(KEY) || 'auto';
  }

  function applyMode() {
    document.body.classList.remove('forcePhoneUI', 'forceDesktopUI');
    if (mode() === 'phone') document.body.classList.add('forcePhoneUI');
    if (mode() === 'desktop') document.body.classList.add('forceDesktopUI');
  }

  const style = document.createElement('style');
  style.textContent = `
    body.forcePhoneUI .layout { display:block !important; width:100% !important; min-height:calc(100vh - 56px) !important; }
    body.forcePhoneUI { background:#f4f4f4 !important; padding-bottom:68px !important; }
    body.forcePhoneUI .topbar { height:56px !important; padding:0 14px !important; }
    body.forcePhoneUI .brand { font-size:18px !important; }
    body.forcePhoneUI .topbar button { min-height:40px !important; padding:8px 12px !important; }
    body.forcePhoneUI .sidebar { position:fixed !important; left:0 !important; right:0 !important; bottom:0 !important; z-index:50 !important; width:100% !important; height:62px !important; padding:5px 6px calc(5px + env(safe-area-inset-bottom)) !important; background:rgba(255,255,255,.98) !important; border:0 !important; border-top:1px solid #d0d0d0 !important; box-shadow:0 -2px 10px rgba(0,0,0,.08) !important; }
    body.forcePhoneUI #userCard { display:none !important; }
    body.forcePhoneUI nav { height:100% !important; display:flex !important; flex-direction:row !important; align-items:stretch !important; justify-content:space-around !important; gap:3px !important; }
    body.forcePhoneUI .nav { flex:1 !important; min-width:0 !important; height:52px !important; padding:7px 3px !important; border-radius:8px !important; text-align:center !important; font-size:12px !important; white-space:nowrap !important; }
    body.forcePhoneUI .feed { width:100% !important; max-width:none !important; padding:16px 10px 20px !important; }
    body.forcePhoneUI .profileStats, body.forcePhoneUI .adminStats { grid-template-columns:1fr !important; }
    body.forcePhoneUI .adminRow { align-items:flex-start !important; flex-direction:column !important; }
    body.forcePhoneUI .adminActions { width:100% !important; justify-content:flex-start !important; }
    body.forcePhoneUI .adminActions .postButton { flex:1 !important; }

    body.forceDesktopUI { background:#f1f1f1 !important; padding-bottom:0 !important; }
    body.forceDesktopUI .topbar { height:60px !important; padding:0 24px !important; }
    body.forceDesktopUI .brand { font-size:20px !important; }
    body.forceDesktopUI .topbar button { min-height:0 !important; padding:8px 14px !important; }
    body.forceDesktopUI .layout { display:flex !important; width:auto !important; max-width:1100px !important; margin:0 auto !important; min-height:calc(100vh - 60px) !important; }
    body.forceDesktopUI .sidebar { position:static !important; width:240px !important; height:auto !important; padding:24px 16px !important; background:#eee !important; border-right:1px solid #d4d4d4 !important; border-top:0 !important; box-shadow:none !important; }
    body.forceDesktopUI #userCard { display:block !important; }
    body.forceDesktopUI nav { height:auto !important; display:flex !important; flex-direction:column !important; align-items:stretch !important; justify-content:normal !important; gap:4px !important; }
    body.forceDesktopUI .nav { flex:none !important; width:100% !important; height:auto !important; padding:12px 14px !important; text-align:left !important; font-size:14px !important; border-radius:4px !important; }
    body.forceDesktopUI .feed { flex:1 !important; width:auto !important; max-width:760px !important; padding:28px 30px !important; }
    body.forceDesktopUI .profileStats { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
    body.forceDesktopUI .adminStats { grid-template-columns:repeat(5,minmax(0,1fr)) !important; }
    body.forceDesktopUI .adminRow { align-items:center !important; flex-direction:row !important; }
    body.forceDesktopUI .adminActions { width:auto !important; justify-content:flex-end !important; }
    body.forceDesktopUI .adminActions .postButton { flex:none !important; }
  `;
  document.head.appendChild(style);

  applyMode();
  window.addEventListener('storage', e => { if (e.key === KEY) applyMode(); });

  function addSettings() {
    const panel = document.querySelector('#adminPanel');
    if (!panel || panel.querySelector('#uiSettingsSection')) return;

    const section = document.createElement('div');
    section.className = 'adminSection';
    section.id = 'uiSettingsSection';
    section.innerHTML = `
      <h2>UI Settings</h2>
      <div class="adminTable">
        <div class="adminRow">
          <div>
            <strong>Interface</strong>
            <small>Choose which Greenverse layout this browser uses.</small>
          </div>
          <div class="adminActions">
            <button class="postButton" type="button" data-ui-mode="desktop">💻 Desktop UI</button>
            <button class="postButton" type="button" data-ui-mode="phone">📱 Phone UI</button>
            <button class="postButton" type="button" data-ui-mode="auto">↩️ Automatic</button>
          </div>
        </div>
      </div>`;
    panel.appendChild(section);
  }

  document.addEventListener('click', e => {
    const button = e.target.closest('[data-ui-mode]');
    if (!button) return;
    const selected = button.dataset.uiMode;
    localStorage.setItem(KEY, selected);
    applyMode();
    addSettings();
    document.querySelectorAll('[data-ui-mode]').forEach(b => {
      b.classList.toggle('yeahActive', b.dataset.uiMode === selected);
    });
  });

  const observer = new MutationObserver(addSettings);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  addSettings();
})();
