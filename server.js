const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "test").trim();
const ADMIN_PASSWORD_HASH = String(process.env.ADMIN_PASSWORD_HASH || "feeea7ab1ad088b71099337051d24f75ec0e71d3f90045a163359c761512ccf0").trim();
const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
const publicDir = path.join(__dirname, "public");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, "miiverse.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT,
    banned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    image TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS post_yeahs (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    admin_user_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn("users", "banned", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("posts", "image", "TEXT");

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadDir));
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDir),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".png";
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    callback(null, allowed.includes(file.mimetype) ? true : new Error("Only PNG, JPEG, WebP and GIF images are allowed."));
  }
});

function getUser(userId) {
  return db.prepare("SELECT id, name, avatar, banned, created_at FROM users WHERE id = ?").get(userId);
}
function isAdmin(userId) {
  const user = getUser(userId);
  return Boolean(user && user.name.toLowerCase() === ADMIN_USERNAME.toLowerCase());
}
function passwordMatches(password) {
  const supplied = crypto.createHash("sha256").update(String(password || "")).digest("hex");
  return supplied === ADMIN_PASSWORD_HASH;
}
function requireAdmin(userId, req, res) {
  const adminPassword = String(req.headers["x-admin-password"] || "");
  if (!Number.isInteger(userId) || userId <= 0 || !isAdmin(userId) || !passwordMatches(adminPassword)) {
    res.status(403).json({ error: "Admin access required." });
    return false;
  }
  return true;
}

app.post("/api/users", upload.single("avatar"), (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 24);
    if (!name) return res.status(400).json({ error: "A name is required." });
    const existing = db.prepare("SELECT id FROM users WHERE name = ? COLLATE NOCASE").get(name);
    if (existing) return res.status(409).json({ error: "That GreenTendo name is already in use. Try logging in instead." });
    const avatar = req.file ? `/uploads/${req.file.filename}` : null;
    const result = db.prepare("INSERT INTO users (name, avatar) VALUES (?, ?)").run(name, avatar);
    res.json({ id: Number(result.lastInsertRowid), name, avatar, banned: 0 });
  } catch (error) { console.error(error); res.status(500).json({ error: "Could not create user." }); }
});

app.post("/api/login", (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 24);
    if (!name) return res.status(400).json({ error: "Enter your GreenTendo name." });
    const matches = db.prepare("SELECT id, name, avatar, banned FROM users WHERE name = ? COLLATE NOCASE").all(name);
    if (matches.length === 0) return res.status(404).json({ error: "No GreenTendo account was found with that name." });
    if (matches.length > 1) return res.status(409).json({ error: "More than one old account has that name. This name cannot be used for passwordless login." });
    if (matches[0].banned) return res.status(403).json({ error: "This GreenTendo account is banned." });
    res.json(matches[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: "Could not log in." }); }
});

app.get("/api/users/:id", (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID." });
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

app.get("/api/users/:id/warnings", (req, res) => {
  const userId = Number(req.params.id);
  const requesterId = Number(req.query.requesterId);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID." });
  if (userId !== requesterId && !isAdmin(requesterId)) return res.status(403).json({ error: "You can only view your own warnings." });
  const warnings = db.prepare(`
    SELECT warnings.id, warnings.reason, warnings.created_at, admins.name AS admin_name
    FROM warnings JOIN users AS admins ON admins.id = warnings.admin_user_id
    WHERE warnings.user_id = ? ORDER BY warnings.id DESC
  `).all(userId);
  res.json(warnings);
});

app.post("/api/admin/login", (req, res) => {
  const userId = Number(req.body.userId);
  if (!Number.isInteger(userId) || userId <= 0 || !isAdmin(userId)) return res.status(403).json({ error: "Admin access required." });
  if (!passwordMatches(req.body.password)) return res.status(401).json({ error: "Incorrect admin password." });
  res.json({ admin: true });
});
app.get("/api/admin/status", (req, res) => {
  const userId = Number(req.query.userId);
  res.json({ admin: Number.isInteger(userId) && userId > 0 && isAdmin(userId) });
});

app.get("/api/admin/stats", (req, res) => {
  const userId = Number(req.query.userId);
  if (!requireAdmin(userId, req, res)) return;
  res.json({
    users: db.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    posts: db.prepare("SELECT COUNT(*) AS count FROM posts").get().count,
    yeahs: db.prepare("SELECT COUNT(*) AS count FROM post_yeahs").get().count,
    warnings: db.prepare("SELECT COUNT(*) AS count FROM warnings").get().count,
    banned: db.prepare("SELECT COUNT(*) AS count FROM users WHERE banned = 1").get().count
  });
});

app.get("/api/admin/users", (req, res) => {
  const adminId = Number(req.query.userId);
  if (!requireAdmin(adminId, req, res)) return;
  const users = db.prepare(`
    SELECT users.id, users.name, users.avatar, users.banned, users.created_at,
           COUNT(warnings.id) AS warning_count
    FROM users LEFT JOIN warnings ON warnings.user_id = users.id
    GROUP BY users.id ORDER BY users.id DESC
  `).all();
  res.json(users);
});

app.get("/api/admin/posts", (req, res) => {
  const adminId = Number(req.query.userId);
  if (!requireAdmin(adminId, req, res)) return;
  const posts = db.prepare(`
    SELECT posts.id, posts.text, posts.image, posts.created_at,
           users.id AS user_id, users.name,
           (SELECT COUNT(*) FROM post_yeahs WHERE post_yeahs.post_id = posts.id) AS yeahs
    FROM posts JOIN users ON users.id = posts.user_id
    ORDER BY posts.id DESC LIMIT 200
  `).all();
  res.json(posts);
});

app.delete("/api/admin/posts/:id", (req, res) => {
  const adminId = Number(req.body.userId);
  const postId = Number(req.params.id);
  if (!requireAdmin(adminId, req, res)) return;
  const post = db.prepare("SELECT image FROM posts WHERE id = ?").get(postId);
  if (!post) return res.status(404).json({ error: "Post not found." });
  db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
  if (post.image && post.image.startsWith("/uploads/")) {
    const filePath = path.join(uploadDir, path.basename(post.image));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ deleted: true });
});

app.post("/api/admin/warnings", (req, res) => {
  const adminId = Number(req.body.adminId);
  const userId = Number(req.body.userId);
  const reason = String(req.body.reason || "").trim().slice(0, 500);
  if (!requireAdmin(adminId, req, res)) return;
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID." });
  if (!reason) return res.status(400).json({ error: "A warning reason is required." });
  if (userId === adminId) return res.status(400).json({ error: "You cannot warn the admin account." });
  if (!getUser(userId)) return res.status(404).json({ error: "User not found." });
  db.prepare("INSERT INTO warnings (user_id, admin_user_id, reason) VALUES (?, ?, ?)").run(userId, adminId, reason);
  const warningCount = db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE user_id = ?").get(userId).count;
  res.json({ warned: true, warningCount });
});

app.post("/api/admin/ban", (req, res) => {
  const adminId = Number(req.body.adminId);
  const userId = Number(req.body.userId);
  if (!requireAdmin(adminId, req, res)) return;
  if (userId === adminId) return res.status(400).json({ error: "You cannot ban the admin account." });
  if (!getUser(userId)) return res.status(404).json({ error: "User not found." });
  db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(userId);
  res.json({ banned: true });
});

app.post("/api/admin/unban", (req, res) => {
  const adminId = Number(req.body.adminId);
  const userId = Number(req.body.userId);
  if (!requireAdmin(adminId, req, res)) return;
  if (!getUser(userId)) return res.status(404).json({ error: "User not found." });
  db.prepare("UPDATE users SET banned = 0 WHERE id = ?").run(userId);
  res.json({ banned: false });
});

app.delete("/api/admin/users/:id", (req, res) => {
  const adminId = Number(req.body.userId);
  const userId = Number(req.params.id);
  if (!requireAdmin(adminId, req, res)) return;
  if (userId === adminId) return res.status(400).json({ error: "You cannot delete the admin account." });
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  const avatar = user.avatar;
  const postImages = db.prepare("SELECT image FROM posts WHERE user_id = ? AND image IS NOT NULL").all(userId);
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM post_yeahs WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)").run(userId, userId);
    db.prepare("DELETE FROM posts WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM warnings WHERE user_id = ? OR admin_user_id = ?").run(userId, userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  transaction();
  const files = [avatar, ...postImages.map(row => row.image)].filter(Boolean);
  for (const file of files) {
    if (!file.startsWith("/uploads/")) continue;
    const filePath = path.join(uploadDir, path.basename(file));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ deleted: true });
});

app.get("/api/posts", (req, res) => {
  try {
    const userId = Number(req.query.userId) || 0;
    const posts = db.prepare(`
      SELECT posts.id, posts.text, posts.image, posts.created_at,
             users.id AS user_id, users.name, users.avatar,
             (SELECT COUNT(*) FROM post_yeahs WHERE post_yeahs.post_id = posts.id) AS yeahs,
             CASE WHEN EXISTS (SELECT 1 FROM post_yeahs WHERE post_yeahs.post_id = posts.id AND post_yeahs.user_id = ?) THEN 1 ELSE 0 END AS yeahed
      FROM posts JOIN users ON users.id = posts.user_id
      WHERE users.banned = 0 ORDER BY posts.id DESC LIMIT 100
    `).all(userId);
    res.json(posts);
  } catch (error) { console.error(error); res.status(500).json({ error: "Could not load posts." }); }
});

app.post("/api/posts", upload.single("image"), (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const text = String(req.body.text || "").trim().slice(0, 500);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID." });
    if (!text && !req.file) return res.status(400).json({ error: "Post cannot be empty." });
    const user = getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.banned) return res.status(403).json({ error: "This account is banned." });
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const result = db.prepare("INSERT INTO posts (user_id, text, image) VALUES (?, ?, ?)").run(userId, text, image);
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (error) { console.error(error); res.status(500).json({ error: "Could not create post." }); }
});

app.post("/api/posts/:id/yeah", (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.body.userId);
    if (!Number.isInteger(postId) || postId <= 0 || !Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid ID." });
    const user = getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.banned) return res.status(403).json({ error: "This account is banned." });
    if (!db.prepare("SELECT id FROM posts WHERE id = ?").get(postId)) return res.status(404).json({ error: "Post not found." });
    const existing = db.prepare("SELECT post_id FROM post_yeahs WHERE post_id = ? AND user_id = ?").get(postId, userId);
    if (existing) {
      db.prepare("DELETE FROM post_yeahs WHERE post_id = ? AND user_id = ?").run(postId, userId);
      return res.json({ yeahed: false, yeahs: db.prepare("SELECT COUNT(*) AS yeahs FROM post_yeahs WHERE post_id = ?").get(postId).yeahs });
    }
    db.prepare("INSERT INTO post_yeahs (post_id, user_id) VALUES (?, ?)").run(postId, userId);
    res.json({ yeahed: true, yeahs: db.prepare("SELECT COUNT(*) AS yeahs FROM post_yeahs WHERE post_id = ?").get(postId).yeahs });
  } catch (error) { console.error(error); res.status(500).json({ error: "Could not change Yeah status." }); }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return res.status(400).json({ error: "Image upload failed." });
  if (error) return res.status(400).json({ error: error.message || "Something went wrong." });
  next();
});

app.listen(PORT, () => {
  console.log(`Greenverse running on port ${PORT}`);
  console.log(`Public directory: ${publicDir}`);
  console.log(`Index exists: ${fs.existsSync(path.join(publicDir, "index.html"))}`);
});
