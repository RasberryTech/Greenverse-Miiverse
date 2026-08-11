const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
const publicDir = path.join(__dirname, "public");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, "miiverse.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS post_yeahs (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadDir));

app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDir),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    callback(null, allowed.includes(file.mimetype) ? true : new Error("Only PNG, JPEG, WebP and GIF images are allowed."));
  }
});

// Phase 1 account creation: intentionally passwordless.
app.post("/api/users", upload.single("avatar"), (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 24);
    if (!name) return res.status(400).json({ error: "A name is required." });

    const existing = db.prepare("SELECT id FROM users WHERE name = ? COLLATE NOCASE").get(name);
    if (existing) return res.status(409).json({ error: "That GreenTendo name is already in use. Try logging in instead." });

    const avatar = req.file ? `/uploads/${req.file.filename}` : null;
    const result = db.prepare("INSERT INTO users (name, avatar) VALUES (?, ?)").run(name, avatar);
    res.json({ id: Number(result.lastInsertRowid), name, avatar });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Could not create user." });
  }
});

// Phase 1 passwordless login: sign out locally, then sign back in with the account name.
app.post("/api/login", (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 24);
    if (!name) return res.status(400).json({ error: "Enter your GreenTendo name." });

    const matches = db.prepare("SELECT id, name, avatar FROM users WHERE name = ? COLLATE NOCASE").all(name);
    if (matches.length === 0) return res.status(404).json({ error: "No GreenTendo account was found with that name." });
    if (matches.length > 1) return res.status(409).json({ error: "More than one old account has that name. This name cannot be used for passwordless login." });

    res.json(matches[0]);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Could not log in." });
  }
});

app.get("/api/users/:id", (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID." });
    const user = db.prepare("SELECT id, name, avatar, created_at FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Could not load user." });
  }
});

app.get("/api/posts", (req, res) => {
  try {
    const userId = Number(req.query.userId) || 0;
    const posts = db.prepare(`
      SELECT posts.id, posts.text, posts.created_at,
             users.id AS user_id, users.name, users.avatar,
             (SELECT COUNT(*) FROM post_yeahs WHERE post_yeahs.post_id = posts.id) AS yeahs,
             CASE WHEN EXISTS (
               SELECT 1 FROM post_yeahs
               WHERE post_yeahs.post_id = posts.id AND post_yeahs.user_id = ?
             ) THEN 1 ELSE 0 END AS yeahed
      FROM posts
      JOIN users ON users.id = posts.user_id
      ORDER BY posts.id DESC
      LIMIT 100
    `).all(userId);
    res.json(posts);
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: "Could not load posts." });
  }
});

app.post("/api/posts", (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const text = String(req.body.text || "").trim().slice(0, 500);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID." });
    if (!text) return res.status(400).json({ error: "Post cannot be empty." });
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    const result = db.prepare("INSERT INTO posts (user_id, text) VALUES (?, ?)").run(userId, text);
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Could not create post." });
  }
});

app.post("/api/posts/:id/yeah", (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.body.userId);
    if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid post ID." });
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID." });
    if (!db.prepare("SELECT id FROM posts WHERE id = ?").get(postId)) return res.status(404).json({ error: "Post not found." });
    if (!db.prepare("SELECT id FROM users WHERE id = ?").get(userId)) return res.status(404).json({ error: "User not found." });

    const existing = db.prepare("SELECT post_id, user_id FROM post_yeahs WHERE post_id = ? AND user_id = ?").get(postId, userId);
    if (existing) {
      db.prepare("DELETE FROM post_yeahs WHERE post_id = ? AND user_id = ?").run(postId, userId);
      const result = db.prepare("SELECT COUNT(*) AS yeahs FROM post_yeahs WHERE post_id = ?").get(postId);
      return res.json({ yeahed: false, yeahs: result.yeahs });
    }

    db.prepare("INSERT INTO post_yeahs (post_id, user_id) VALUES (?, ?)").run(postId, userId);
    const result = db.prepare("SELECT COUNT(*) AS yeahs FROM post_yeahs WHERE post_id = ?").get(postId);
    res.json({ yeahed: true, yeahs: result.yeahs });
  } catch (error) {
    console.error("Yeah error:", error);
    res.status(500).json({ error: "Could not change Yeah status." });
  }
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
