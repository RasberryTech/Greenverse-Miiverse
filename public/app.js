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
  try { return new Date(String(value).replace(" ", "T") + "Z").toLocaleString(); }
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

// Load the feed from the same Render server. This function is intentionally
// global because the post composer and other Greenverse scripts call it.
async function loadPosts() {
  if (!feed) return;
  try {
    const userId = currentUser ? currentUser.id : 0;
    const response = await fetch(`/api/posts?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await getResponseError(response, "Could not load posts."));
    const posts = await response.json();

    if (!Array.isArray(posts) || posts.length === 0) {
      feed.innerHTML = '<div class="post"><div class="postText">No posts yet. Be the first to post!</div></div>';
      return;
    }

    feed.innerHTML = posts.map(post => {
      const avatar = getAvatar(post.avatar);
      const image = post.image ? `<img class="postImage" src="${escapeHtml(post.image)}" alt="Post image" loading="lazy">` : "";
      const yeahs = Number(post.yeahs || 0);
      const yeahed = Number(post.yeahed || 0) === 1;
      return `<article class="post">
        <div class="postHeader">
          <img class="avatar" src="${avatar}" alt="">
          <div><strong>${escapeHtml(post.name)}</strong><div class="postDate">${escapeHtml(formatDate(post.created_at))}</div></div>
        </div>
        ${post.text ? `<div class="postText">${escapeHtml(post.text).replace(/\n/g, "<br>")}</div>` : ""}
        ${image}
        <div class="postActions"><button class="yeahButton${yeahed ? " active" : ""}" type="button" data-id="${Number(post.id)}">Yeah <span>${yeahs}</span></button></div>
      </article>`;
    }).join("");
  } catch (error) {
    console.error("Could not load Greenverse posts:", error);
    feed.innerHTML = `<div class="post"><div class="error">${escapeHtml(error.message || "Could not load posts.")}</div></div>`;
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
  userCard.innerHTML = `<img class="avatar" src="${getAvatar(currentUser.avatar)}" alt=""><b>${escapeHtml(currentUser.name)}</b><div class="postDate">Signed in</div>`;
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
  userProfile.innerHTML = `<div class="profileHero"><img class="profileAvatar" src="${getAvatar(currentUser.avatar)}" alt=""><h2>${escapeHtml(currentUser.name)}</h2><p>Greenverse user #${currentUser.id}</p></div><div class="profileStats" id="profileStats"><div class="stat"><strong>—</strong><span>Posts made</span></div><div class="stat"><strong>—</strong><span>Yeahs received</span></div><div class="stat"><strong>—</strong><span>Yeahs given</span></div></div>`;
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
  adminPanel.innerHTML = `<div class="profileHero"><h2>Greenverse Admin</h2><p>Signed in as ${escapeHtml(currentUser.name)}</p></div>`;
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const errorElement = document.querySelector("#loginError");
  errorElement.textContent = "";
  try {
    const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: document.querySelector("#loginName").value.trim() }) });
    if (!response.ok) { errorElement.textContent = await getResponseError(response, "Could not log in."); return; }
    currentUser = await response.json();
    localStorage.setItem("miiverseUser", JSON.stringify(currentUser));
    renderUser();
    await checkAdmin();
    await loadPosts();
  } catch (error) { console.error(error); errorElement.textContent = "Could not connect to the server."; }
});

userForm.addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const errorElement = document.querySelector("#error");
  errorElement.textContent = "";
  try {
    const response = await fetch("/api/users", { method: "POST", body: form });
    if (!response.ok) { errorElement.textContent = await getResponseError(response, "Could not create account."); return; }
    currentUser = await response.json();
    localStorage.setItem("miiverseUser", JSON.stringify(currentUser));
    renderUser();
    await checkAdmin();
    await loadPosts();
  } catch (error) { console.error(error); errorElement.textContent = "Could not connect to the server."; }
});

postForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return renderUser();
  const text = postText.value.trim();
  if (!text) return;

  try {
    const form = new FormData();
    form.append("userId", String(currentUser.id));
    form.append("text", text);
    const response = await fetch("/api/posts", { method: "POST", body: form });
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
if (currentUser) checkAdmin().then(() => showCommunity());
else showAccountChoice();
