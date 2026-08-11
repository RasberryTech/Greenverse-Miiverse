const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;


/*
==================================================
DIRECTORIES
==================================================
*/

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
const publicDir = path.join(__dirname, "public");

fs.mkdirSync(dataDir, {
  recursive: true
});

fs.mkdirSync(uploadDir, {
  recursive: true
});


/*
==================================================
DATABASE
==================================================
*/

const dbPath = path.join(
  dataDir,
  "miiverse.sqlite"
);

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");


/*
==================================================
DATABASE TABLES
==================================================
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    avatar TEXT,

    created_at
      TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    text TEXT NOT NULL,

    created_at
      TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS post_yeahs (
    post_id INTEGER NOT NULL,

    user_id INTEGER NOT NULL,

    PRIMARY KEY (
      post_id,
      user_id
    ),

    FOREIGN KEY (post_id)
      REFERENCES posts(id)
      ON DELETE CASCADE,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  );
`);


/*
==================================================
EXPRESS
==================================================
*/

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);


/*
==================================================
STATIC WEBSITE
==================================================
*/

console.log(
  "Public directory:",
  publicDir
);

console.log(
  "Index exists:",
  fs.existsSync(
    path.join(
      publicDir,
      "index.html"
    )
  )
);

app.use(
  express.static(
    publicDir
  )
);


/*
==================================================
HOMEPAGE
==================================================
*/

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        publicDir,
        "index.html"
      )
    );

  }
);


/*
==================================================
UPLOADS
==================================================
*/

app.use(
  "/uploads",
  express.static(
    uploadDir
  )
);


/*
==================================================
MULTER
==================================================
*/

const storage =
  multer.diskStorage({

    destination:
      function (
        req,
        file,
        callback
      ) {

        callback(
          null,
          uploadDir
        );

      },

    filename:
      function (
        req,
        file,
        callback
      ) {

        const extension =
          path
            .extname(
              file.originalname
            )
            .toLowerCase();

        const filename =
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}${extension}`;

        callback(
          null,
          filename
        );

      }

  });


const upload =
  multer({

    storage: storage,

    limits: {
      fileSize:
        2 * 1024 * 1024
    },

    fileFilter:
      function (
        req,
        file,
        callback
      ) {

        const allowed =
          [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif"
          ];

        if (
          allowed.includes(
            file.mimetype
          )
        ) {

          callback(
            null,
            true
          );

        } else {

          callback(
            new Error(
              "Only PNG, JPEG, WebP and GIF images are allowed."
            )
          );

        }

      }

  });


/*
==================================================
CREATE USER
==================================================
*/

app.post(
  "/api/users",

  upload.single("avatar"),

  (req, res) => {

    try {

      const name =
        String(
          req.body.name || ""
        )
          .trim()
          .slice(
            0,
            24
          );


      if (!name) {

        return res
          .status(400)
          .json({
            error:
              "A name is required."
          });

      }


      let avatar = null;


      if (req.file) {

        avatar =
          `/uploads/${req.file.filename}`;

      }


      const result =
        db
          .prepare(`
            INSERT INTO users
              (
                name,
                avatar
              )

            VALUES
              (?, ?)
          `)
          .run(
            name,
            avatar
          );


      res.json({

        id:
          Number(
            result.lastInsertRowid
          ),

        name:
          name,

        avatar:
          avatar

      });

    } catch (error) {

      console.error(
        "Create user error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not create user."
        });

    }

  }
);


/*
==================================================
GET USER
==================================================
*/

app.get(
  "/api/users/:id",

  (req, res) => {

    try {

      const userId =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {

        return res
          .status(400)
          .json({
            error:
              "Invalid user ID."
          });

      }


      const user =
        db
          .prepare(`
            SELECT
              id,
              name,
              avatar,
              created_at

            FROM users

            WHERE id = ?
          `)
          .get(
            userId
          );


      if (!user) {

        return res
          .status(404)
          .json({
            error:
              "User not found."
          });

      }


      res.json(
        user
      );

    } catch (error) {

      console.error(
        "Get user error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not load user."
        });

    }

  }
);


/*
==================================================
GET POSTS
==================================================
*/

app.get(
  "/api/posts",

  (req, res) => {

    try {

      const userId =
        Number(
          req.query.userId
        ) || 0;


      const posts =
        db
          .prepare(`
            SELECT

              posts.id,

              posts.text,

              posts.created_at,

              users.id
                AS user_id,

              users.name,

              users.avatar,

              (
                SELECT COUNT(*)

                FROM post_yeahs

                WHERE
                  post_yeahs.post_id =
                  posts.id

              ) AS yeahs,

              CASE

                WHEN EXISTS (

                  SELECT 1

                  FROM post_yeahs

                  WHERE
                    post_yeahs.post_id =
                    posts.id

                  AND
                    post_yeahs.user_id =
                    ?

                )

                THEN 1

                ELSE 0

              END AS yeahed

            FROM posts

            JOIN users
              ON users.id =
                 posts.user_id

            ORDER BY
              posts.id DESC

            LIMIT 100
          `)
          .all(
            userId
          );


      res.json(
        posts
      );

    } catch (error) {

      console.error(
        "Get posts error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not load posts."
        });

    }

  }
);


/*
==================================================
CREATE POST
==================================================
*/

app.post(
  "/api/posts",

  (req, res) => {

    try {

      const userId =
        Number(
          req.body.userId
        );


      const text =
        String(
          req.body.text || ""
        )
          .trim()
          .slice(
            0,
            500
          );


      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {

        return res
          .status(400)
          .json({
            error:
              "Invalid user ID."
          });

      }


      if (!text) {

        return res
          .status(400)
          .json({
            error:
              "Post cannot be empty."
          });

      }


      const user =
        db
          .prepare(`
            SELECT id

            FROM users

            WHERE id = ?
          `)
          .get(
            userId
          );


      if (!user) {

        return res
          .status(404)
          .json({
            error:
              "User not found."
          });

      }


      const result =
        db
          .prepare(`
            INSERT INTO posts
              (
                user_id,
                text
              )

            VALUES
              (?, ?)
          `)
          .run(
            userId,
            text
          );


      res.json({

        id:
          Number(
            result.lastInsertRowid
          )

      });

    } catch (error) {

      console.error(
        "Create post error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not create post."
        });

    }

  }
);


/*
==================================================
YEAH / UNYEAH
==================================================
*/

app.post(
  "/api/posts/:id/yeah",

  (req, res) => {

    try {

      const postId =
        Number(
          req.params.id
        );


      const userId =
        Number(
          req.body.userId
        );


      if (
        !Number.isInteger(
          postId
        ) ||
        postId <= 0
      ) {

        return res
          .status(400)
          .json({
            error:
              "Invalid post ID."
          });

      }


      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {

        return res
          .status(400)
          .json({
            error:
              "Invalid user ID."
          });

      }


      const post =
        db
          .prepare(`
            SELECT id

            FROM posts

            WHERE id = ?
          `)
          .get(
            postId
          );


      if (!post) {

        return res
          .status(404)
          .json({
            error:
              "Post not found."
          });

      }


      const user =
        db
          .prepare(`
            SELECT id

            FROM users

            WHERE id = ?
          `)
          .get(
            userId
          );


      if (!user) {

        return res
          .status(404)
          .json({
            error:
              "User not found."
          });

      }


      const existing =
        db
          .prepare(`
            SELECT
              post_id,
              user_id

            FROM post_yeahs

            WHERE
              post_id = ?

            AND
              user_id = ?
          `)
          .get(
            postId,
            userId
          );


      /*
      UNYEAH
      */

      if (existing) {

        db
          .prepare(`
            DELETE FROM post_yeahs

            WHERE
              post_id = ?

            AND
              user_id = ?
          `)
          .run(
            postId,
            userId
          );


        const result =
          db
            .prepare(`
              SELECT
                COUNT(*) AS yeahs

              FROM post_yeahs

              WHERE
                post_id = ?
            `)
            .get(
              postId
            );


        return res.json({

          yeahed:
            false,

          yeahs:
            result.yeahs

        });

      }


      /*
      YEAH
      */

      db
        .prepare(`
          INSERT INTO post_yeahs
            (
              post_id,
              user_id
            )

          VALUES
            (?, ?)
        `)
        .run(
          postId,
          userId
        );


      const result =
        db
          .prepare(`
            SELECT
              COUNT(*) AS yeahs

            FROM post_yeahs

            WHERE
              post_id = ?
          `)
          .get(
            postId
          );


      res.json({

        yeahed:
          true,

        yeahs:
          result.yeahs

      });

    } catch (error) {

      console.error(
        "Yeah error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not change Yeah status."
        });

    }

  }
);


/*
==================================================
ERROR HANDLER
==================================================
*/

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      error
    );


    if (
      error instanceof
      multer.MulterError
    ) {

      return res
        .status(400)
        .json({
          error:
            "Image upload failed."
        });

    }


    if (error) {

      return res
        .status(400)
        .json({
          error:
            error.message ||
            "Something went wrong."
        });

    }


    next();

  }
);


/*
==================================================
START SERVER
==================================================
*/

app.listen(
  PORT,

  () => {

    console.log(
      `Greenverse running on port ${PORT}`
    );

    console.log(
      `Public directory: ${publicDir}`
    );

    console.log(
      `Index exists: ${
        fs.existsSync(
          path.join(
            publicDir,
            "index.html"
          )
        )
      }`
    );

  }
);
