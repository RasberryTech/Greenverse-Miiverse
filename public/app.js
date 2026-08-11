let currentUser = JSON.parse(localStorage.getItem("miiverseUser") || "null");

const setup = document.querySelector("#setup");
const userCard = document.querySelector("#userCard");
const feed = document.querySelector("#feed");
const postForm = document.querySelector("#postForm");
const postText = document.querySelector("#postText");
const counter = document.querySelector("#counter");
const changeUserButton = document.querySelector("#changeUser");
const communitiesNav = document.querySelector("#communitiesNav");
const userMenuNav = document.querySelector("#userMenuNav");
const communityList = document.querySelector("#communityList");
const miiverseGeneralButton = document.querySelector("#miiverseGeneralButton");
const communityView = document.querySelector("#communityView");
const userMenuView = document.querySelector("#userMenuView");
const userProfile = document.querySelector("#userProfile");
const pageHeading = document.querySelector("#pageHeading");
const sectionLabel = document.querySelector("#sectionLabel");

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
  try {
    return new Date(value.replace(" ", "T") + "Z").toLocaleString();
  } catch {
    return value;
  }
}

function renderUser() {
  if (!currentUser) {
    setup.style.display = "grid";
    userCard.innerHTML = "";
    return;
  }

  setup.style.display = "none";
  userCard.innerHTML = `
    <img class="avatar" src="${getAvatar(currentUser.avatar)}" alt="">
    <b>${escapeHtml(currentUser.name)}</b>
    <div class="postDate">Signed in</div>
  `;
}

function showCommunity() {
  communitiesNav.classList.add("active");
  userMenuNav.classList.remove("active");
  communityList.hidden = false;
  communityView.hidden = false;
  userMenuView.hidden = true;
  miiverseGeneralButton.classList.add("active");
  sectionLabel.textContent = "COMMUNITY";
  pageHeading.textContent = "Miiverse General";
  loadPosts();
}

function showUserMenu() {
  communitiesNav.classList.remove("active");
  userMenuNav.classList.add("active");
  communityList.hidden = true;
  communityView.hidden = true;
  userMenuView.hidden = false;
  sectionLabel.textContent = "USER MENU";
  pageHeading.textContent = currentUser ? currentUser.name : "User Menu";
  renderUserMenu();
}

async function renderUserMenu() {
  if (!currentUser) {
    userProfile.innerHTML = "<div class='post'><div class='postText'>Sign in to view your User Menu.</div></div>";
    return;
  }

  userProfile.innerHTML = `
    <div class="profileHero">
      <img class="profileAvatar" src="${getAvatar(currentUser.avatar)}" alt="">
      <h2>${escapeHtml(currentUser.name)}</h2>
      <p>Your Greenverse profile</p>
    </div>
    <div class="profileStats">
      <div class="profileStat"><strong id="postStat">—</strong><span>Posts made</span></div>
      <div class="profileStat"><strong id="receivedStat">—</strong><span>Yeahs on your posts</span></div>
      <div class="profileStat"><strong id="givenStat">—</strong><span>Yeahs given</span></div>
    </div>
  `;

  try {
    const response = await fetch(`/api/users/${currentUser.id}/stats`);
    if (!response.ok) return;
    const stats = await response.json();
    document.querySelector("#postStat").textContent = stats.posts;
    document.querySelector("#receivedStat").textContent = stats.yeahsReceived;
    document.querySelector("#givenStat").textContent = stats.yeahsGiven;
  } catch (error) {
    console.error("Could not load user stats:", error);
  }
}

async function loadPosts() {
  if (userMenuView.hidden === false) return;
  try {
    const userId = currentUser ? currentUser.id : 0;
    const response = await fetch(`/api/posts?userId=${userId}`);
    if (!response.ok) throw new Error("Could not load posts.");
    const posts = await response.json();

    if (!posts.length) {
      feed.innerHTML = `<div class="post"><div class="postText">No posts yet. Be the first person to post something!</div></div>`;
      return;
    }

    feed.innerHTML = posts.map(post => {
      const buttonText = post.yeahed ? "Unyeah" : "Yeah!";
      const activeClass = post.yeahed ? " yeahActive" : "";
      return `
        <article class="post">
          <div class="postHeader">
            <img class="avatar" src="${getAvatar(post.avatar)}" alt="">
            <div>
              <div class="postName">${escapeHtml(post.name)}</div>
              <div class="postDate">${formatDate(post.created_at)}</div>
            </div>
          </div>
          <div class="postText">${escapeHtml(post.text)}</div>
          <button class="yeahButton${activeClass}" data-id="${post.id}">${buttonText} ${post.yeahs}</button>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error("Could not load posts:", error);
  }
}

document.querySelector("#userForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const errorElement = document.querySelector("#error");
  errorElement.textContent = "";

  try {
    const response = await fetch("/api/users", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      errorElement.textContent = data.error || "Could not create user.";
      return;
    }
    currentUser = data;
    localStorage.setItem("miiverseUser", JSON.stringify(currentUser));
    renderUser();
    showCommunity();
  } catch (error) {
    console.error(error);
    errorElement.textContent = "Could not connect to the server.";
  }
});

postForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) {
    renderUser();
    return;
  }
  const text = postText.value.trim();
  if (!text) return;

  try {
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, text })
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Could not create post.");
      return;
    }
    postText.value = "";
    counter.textContent = "0 / 500";
    await loadPosts();
  } catch (error) {
    console.error(error);
    alert("Could not connect to the server.");
  }
});

postText.addEventListener("input", () => {
  counter.textContent = `${postText.value.length} / 500`;
});

feed.addEventListener("click", async event => {
  const button = event.target.closest(".yeahButton");
  if (!button) return;
  if (!currentUser) {
    renderUser();
    return;
  }

  try {
    button.disabled = true;
    const response = await fetch(`/api/posts/${button.dataset.id}/yeah`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id })
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Could not change Yeah status.");
      return;
    }
    await loadPosts();
  } catch (error) {
    console.error(error);
    alert("Could not connect to the server.");
  }
});

communitiesNav.addEventListener("click", showCommunity);
userMenuNav.addEventListener("click", showUserMenu);
miiverseGeneralButton.addEventListener("click", showCommunity);

changeUserButton.addEventListener("click", () => {
  localStorage.removeItem("miiverseUser");
  currentUser = null;
  renderUser();
  showCommunity();
});

renderUser();
showCommunity();
setInterval(loadPosts, 5000);