(() => {
  const adminNav = document.querySelector("#adminNav");
  const adminView = document.querySelector("#adminView");
  const adminPanel = document.querySelector("#adminPanel");
  const communitiesNav = document.querySelector("#communitiesNav");
  const userMenuNav = document.querySelector("#userMenuNav");
  const communityList = document.querySelector("#communityList");
  const communityView = document.querySelector("#communityView");
  const userMenuView = document.querySelector("#userMenuView");
  const pageHeading = document.querySelector("#pageHeading");
  const sectionLabel = document.querySelector("#sectionLabel");

  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem("miiverseUser") || "null"); }
    catch { return null; }
  }

  async function updateAdminButton() {
    const user = getStoredUser();
    if (!user) {
      adminNav.hidden = true;
      return;
    }
    try {
      const response = await fetch(`/api/admin/status?userId=${encodeURIComponent(user.id)}`);
      const data = await response.json();
      adminNav.hidden = !data.admin;
    } catch {
      adminNav.hidden = true;
    }
  }

  async function openAdmin() {
    const user = getStoredUser();
    if (!user) return;

    const password = window.prompt("Enter the admin password:");
    if (password === null) return;

    const loginResponse = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, password })
    });
    const loginData = await loginResponse.json();
    if (!loginResponse.ok) {
      alert(loginData.error || "Admin authentication failed.");
      return;
    }

    communitiesNav.classList.remove("active");
    userMenuNav.classList.remove("active");
    adminNav.classList.add("active");
    communityList.hidden = true;
    communityView.hidden = true;
    userMenuView.hidden = true;
    adminView.hidden = false;
    sectionLabel.textContent = "ADMIN";
    pageHeading.textContent = "Admin Panel";
    adminPanel.innerHTML = `
      <div class="profileHero">
        <h2>Greenverse Admin</h2>
        <p>Administrator: ${user.name}</p>
      </div>
      <div class="profileStats" style="margin-top:28px">
        <div class="stat"><strong>—</strong><span>Total accounts</span></div>
        <div class="stat"><strong>—</strong><span>Total posts</span></div>
        <div class="stat"><strong>—</strong><span>Total Yeahs</span></div>
      </div>`;

    const statsResponse = await fetch(`/api/admin/stats?userId=${encodeURIComponent(user.id)}`, {
      headers: { "X-Admin-Password": password }
    });
    const stats = await statsResponse.json();
    if (!statsResponse.ok) {
      adminPanel.innerHTML += `<div class="post"><div class="postText">${stats.error || "Could not load admin statistics."}</div></div>`;
      return;
    }
    adminPanel.querySelector(".profileStats").innerHTML = `
      <div class="stat"><strong>${stats.users}</strong><span>Total accounts</span></div>
      <div class="stat"><strong>${stats.posts}</strong><span>Total posts</span></div>
      <div class="stat"><strong>${stats.yeahs}</strong><span>Total Yeahs</span></div>`;
  }

  adminNav.addEventListener("click", openAdmin);
  updateAdminButton();
  setInterval(updateAdminButton, 2000);
})();
