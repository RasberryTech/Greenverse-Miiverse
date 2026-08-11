let currentUser = JSON.parse(localStorage.getItem("miiverseUser") || "null");

const setup = document.querySelector("#setup");
const accountChoice = document.querySelector("#accountChoice");
const loginForm = document.querySelector("#loginForm");
const userForm = document.querySelector("#userForm");
const userCard = document.querySelector("#userCard");
const feed = document.querySelector("#feed");
const postForm = document.querySelector("#postForm");
const postText = document.querySelector("#postText");
const counter = document.querySelector("#counter");
const changeUserButton = document.querySelector("#changeUser");
const communitiesNav = document.querySelector("#communitiesNav");
const userMenuNav = document.querySelector("#userMenuNav");
const adminNav = document.querySelector("#adminNav");
const communityList = document.querySelector("#communityList");
const communityView = document.querySelector("#communityView");
const userMenuView = document.querySelector("#userMenuView");
const adminView = document.querySelector("#adminView");
const userProfile = document.querySelector("#userProfile");
const adminPanel = document.querySelector("#adminPanel");
const pageHeading = document.querySelector("#pageHeading");
const sectionLabel = document.querySelector("#sectionLabel");
const miiverseGeneralButton = document.querySelector("#miiverseGeneralButton");

let isAdmin = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function getAvatar(url) {
  if (url) return url;
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23ddd'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23999'/%3E%3Ccircle cx='40' cy='76' r='25' fill='%23999'/%3E%3C/svg%3E";
}

function formatDate(value) {
  try { return new Date(value.replace(" ", "T") + "Z").toLocaleString(); }
  catch { return value; }
}

async function getResponseError(response, fallback) {
  const contentType = response.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data.error || fallback;
    }
    const text = (await response.text()).trim();
    return text || `${fallback} (HTTP ${response.status})`;
  } catch {
    return `${fallback} (HTTP ${response.status})`;
  }
}

function showAccountChoice() {
  accountChoice.hidden = false;
  loginForm.hidden = true;
  userForm.hidden = true;
}

function showLoginForm() {
  accountChoice.hidden = true;
  loginForm.hidden = false;
  userForm.hidden = true;
  document.querySelector("#loginError").textContent = "";
  document.querySelector("#loginName").focus();
}

function showCreateForm() {
  accountChoice.hidden = true;
  loginForm.hidden = true;
  userForm.hidden = false;
  document.querySelector("#error").textContent = "";
  userForm.querySelector('[name="name"]').focus();
}

async function checkAdmin() {
  if (!currentUser) {
    isAdmin = false;
    adminNav.hidden = true;
    return;
  }
  try {
    const response = await fetch(`/api/admin/status?userId=${currentUser.id}`);
    const data = await response.json();
    isAdmin = response.ok && data.admin === true;
    adminNav.hidden = !isAdmin;
  } catch {
    isAdmin = false;
    adminNav.hidden = true;
  }
}

function renderUser() {
  if (!currentUser) {
    setup.style.display = "grid";
    changeUserButton.textContent = "Log In";
    userCard.innerHTML = "<div class=\"postDate\">Not signed in</div>";
    adminNav.hidden = true;
    showAccountChoice();
    return;
  }

  setup.style.display = "none";
  changeUserButton.textContent = "Log Out";
  userCard.innerHTML = `
    <img class="avatar" src="${getAvatar(currentUser.avatar)}" alt="">
    <b>${escapeHtml(currentUser.name)}</b>
    <div class="postDate">Signed in</div>
  `;
}

function showCommunity() {
  if (!currentUser) return renderUser();
  communitiesNav.classList.add("active");
  userMenuNav.classList.remove("active");
  adminNav.classList.remove("active");
  communityList.hidden = false;
  communityView.hidden = false;
  userMenuView.hidden = true;
  adminView.hidden = true;
  sectionLabel.textContent = "COMMUNITY";
  pageHeading.textContent = "Miiverse General";
  miiverseGeneralButton.classList.add("active");
  loadPosts();
}

async function showUserMenu() {
  if (!currentUser) return renderUser();

  communitiesNav.classList.remove("active");
  userMenuNav.classList.add("active");
  adminNav.classList.remove("active");
  communityList.hidden = true;
  communityView.hidden = true;
  userMenuView.hidden = false;
  adminView.hidden = true;
  sectionLabel.textContent = "USER MENU";
  pageHeading.textContent = "User Menu";

  userProfile.innerHTML = `
    <div class="profileHero">
      <img class="profileAvatar" src="${getAvatar(currentUser.avatar)}" alt="">
      <h2>${escapeHtml(currentUser.name)}</h2>
      <p>Greenverse user #${currentUser.id}</p>
    </div>
    <div class="profileStats" id="profileStats">
      <div class="stat"><strong>—</strong><span>Posts made</span></div>
      <div class="stat"><strong>—</strong><span>Yeahs received</span></div>
      <div class="stat"><strong>—</strong><span>Yeahs given</span></div>
    </div>
  `;

  try {
    const response = await fetch(`/api/posts?userId=${currentUser.id}`);
    if (!response.ok) throw new Error(await getResponseError(response, "Could not load statistics."));
    const posts = await response.json();
    const myPosts = posts.filter(post => Number(post.user_id) === Number(currentUser.id));
    const postsMade = myPosts.length;
    const yeahsReceived = myPosts.reduce((total, post) => total + Number(post.yeahs || 0), 0);
    const yeahsGiven = posts.reduce((total, post) => total + (post.yeahed ? 1 : 0), 0);
    document.querySelector("#profileStats").innerHTML = `
      <div class="stat"><strong>${postsMade}</strong><span>Posts made</span></div>
      <div class="stat"><strong>${yeahsReceived}</strong><span>Yeahs received</span></div>
      <div class="stat"><strong>${yeahsGiven}</strong><span>Yeahs given</span></div>
    `;
  } catch (error) {
    console.error("Could not load user statistics:", error);
  }
}

async function showAdminPanel() {
  if (!currentUser || !isAdmin) return showCommunity();

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
      <p>Signed in as ${escapeHtml(currentUser.name)}</p>
    </div>
    <div class="profileStats" id="adminStats">
      <div class="stat"><strong>—</strong><span>Accounts</span></div>
      <div class="stat"><strong>—</strong><span>Posts</span></div>
      <div class="stat"><strong>—</strong><span>Yeahs</span></div>
    </div>
  `;

  try {
    const response = await fetch(`/api/admin/stats?userId=${currentUser.id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Admin access denied.");
    document.querySelector("#adminStats").innerHTML = `
      <div class="stat"><strong>${data.users}</strong><span>Accounts</span></div>
      <div class="stat"><strong>${data.posts}</strong><span>Posts</span></div>
      <div class="stat"><strong>${data.yeahs}</strong><span>Yeahs</span></div>
    `;
  } catch (error) {
    adminPanel.innerHTML += `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const errorElement = document.querySelector("#loginError");
  errorElement.textContent = "";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: document.querySelector("#loginName").value.trim() })
    });
    if (!response.ok) {
      errorElement.textContent = await getResponseError(response, "Could not log in.");
      return;
    }
    const data = await response.json();
    currentUser = data;
    localStorage.setItem("miiverseUser", JSON.stringify(currentUser));
    renderUser();
    await checkAdmin();
    await loadPosts();
  } catch (error) {
    console.error(error);
    errorElement.textContent = "Could not connect to the server.";
  }
});

userForm.addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const errorElement = document.querySelector("#error");
  errorElement.textContent = "";
  try {
    const response = await fetch("/api/users", { method: "POST", body: form });
    if (!response.ok) {
      errorElement.textContent = await getResponseError(response, "Could not create account.");
      return;
    }
    const data = await response.json();
    currentUser = data;
    localStorage.setItem("miiverseUser", JSON.stringify(currentUser));
    renderUser();
    await checkAdmin();
    await loadPosts();
  } catch (error) {
    console.error(error);
    errorElement.textContent = "Could not connect to the server.";
  }
});

postForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return renderUser();
  const text = postText.value.trim();
  if (!text) return;

  try {
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, text })
    });

    if (!response.ok) {
      const message = await getResponseError(response, "Could not create post.");
      console.error("Greenverse post request failed:", response.status, message);
      return alert(message);
    }

    const data = await response.json();
    if (!data.id) return alert("The server did not confirm the post was created.");
    postText.value = "";
    counter.textContent = "0 / 500";
    await loadPosts();
  } catch (error) {
    console.error("Greenverse post request failed:", error);
    alert("Could not connect to the server. Check the Render logs for the /api/posts request.");
  }
});

postText.addEventListener("input", () => { counter.textContent = `${postText.value.length} / 500`; });

feed.addEventListener("click", async event => {
  const button = event.target.closest(".yeahButton");
  if (!button) return;
  if (!currentUser) return renderUser();
  try {
    button.disabled = true;
    const response = await fetch(`/api/posts/${button.dataset.id}/yeah`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id })
    });
    if (!response.ok) return alert(await getResponseError(response, "Could not change Yeah status."));
    await response.json();
    await loadPosts();
  } catch (error) {
    console.error(error);
    alert("Could not connect to the server.");
  }
});

document.querySelector("#showLogin").addEventListener("click", showLoginForm);
document.querySelector("#showCreate").addEventListener("click", showCreateForm);
document.querySelector("#backToChoiceFromLogin").addEventListener("click", showAccountChoice);
document.querySelector("#backToChoiceFromCreate").addEventListener("click", showAccountChoice);
communitiesNav.addEventListener("click", showCommunity);
miiverseGeneralButton.addEventListener("click", showCommunity);
userMenuNav.addEventListener("click", showUserMenu);
adminNav.addEventListener("click", showAdminPanel);

changeUserButton.addEventListener("click", () => {
  if (!currentUser) return showLoginForm();
  localStorage.removeItem("miiverseUser");
  currentUser = null;
  isAdmin = false;
  renderUser();
});

renderUser();
if (currentUser) {
  checkAdmin().then(() => showCommunity());
} else {
  showAccountChoice();
}

setInterval(() => {
  if (!currentUser) return;
  if (!userMenuView.hidden) showUserMenu();
  else if (!adminView.hidden) return;
  else if (!communityView.hidden) loadPosts();
}, 5000);
