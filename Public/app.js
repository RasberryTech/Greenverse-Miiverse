/*
==================================================
CURRENT USER
==================================================
*/

let currentUser =
  JSON.parse(
    localStorage.getItem(
      "miiverseUser"
    ) || "null"
  );


/*
==================================================
ELEMENTS
==================================================
*/

const setup =
  document.querySelector("#setup");

const userCard =
  document.querySelector("#userCard");

const feed =
  document.querySelector("#feed");

const postForm =
  document.querySelector("#postForm");

const postText =
  document.querySelector("#postText");

const counter =
  document.querySelector("#counter");

const changeUserButton =
  document.querySelector("#changeUser");


/*
==================================================
HTML ESCAPING
==================================================
*/

function escapeHtml(value) {

  return String(value).replace(
    /[&<>"']/g,

    character => {

      const entities = {

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#039;"

      };

      return entities[
        character
      ];

    }
  );

}


/*
==================================================
AVATAR
==================================================
*/

function getAvatar(url) {

  if (url) {

    return url;

  }

  return `
    data:image/svg+xml,
    %3Csvg
    xmlns='http://www.w3.org/2000/svg'
    width='80'
    height='80'
    %3E

    %3Crect
    width='100%25'
    height='100%25'
    fill='%23ddd'
    /%3E

    %3Ccircle
    cx='40'
    cy='32'
    r='16'
    fill='%23999'
    /%3E

    %3Ccircle
    cx='40'
    cy='76'
    r='25'
    fill='%23999'
    /%3E

    %3C/svg%3E
  `;

}


/*
==================================================
FORMAT DATE
==================================================
*/

function formatDate(value) {

  try {

    return new Date(
      value.replace(
        " ",
        "T"
      ) + "Z"
    ).toLocaleString();

  } catch {

    return value;

  }

}


/*
==================================================
RENDER USER
==================================================
*/

function renderUser() {

  if (!currentUser) {

    setup.style.display =
      "grid";

    userCard.innerHTML =
      "";

    return;

  }


  setup.style.display =
    "none";


  userCard.innerHTML = `

    <img
      class="avatar"
      src="${getAvatar(
        currentUser.avatar
      )}"
      alt=""
    >

    <b>
      ${escapeHtml(
        currentUser.name
      )}
    </b>

    <div class="postDate">
      Signed in
    </div>

  `;

}


/*
==================================================
LOAD POSTS
==================================================
*/

async function loadPosts() {

  try {

    const userId =
      currentUser
        ? currentUser.id
        : 0;


    const response =
      await fetch(
        `/api/posts?userId=${userId}`
      );


    if (!response.ok) {

      throw new Error(
        "Could not load posts."
      );

    }


    const posts =
      await response.json();


    /*
    Empty feed.
    */

    if (!posts.length) {

      feed.innerHTML = `

        <div class="post">

          <div class="postText">

            No posts yet.

            Be the first person to
            post something!

          </div>

        </div>

      `;

      return;

    }


    /*
    Build feed.
    */

    feed.innerHTML =
      posts
        .map(
          post => {

            const buttonText =
              post.yeahed
                ? "Unyeah"
                : "Yeah!";


            const activeClass =
              post.yeahed
                ? " yeahActive"
                : "";


            return `

              <article
                class="post"
              >

                <div
                  class="postHeader"
                >

                  <img
                    class="avatar"
                    src="${getAvatar(
                      post.avatar
                    )}"
                    alt=""
                  >

                  <div>

                    <div
                      class="postName"
                    >
                      ${escapeHtml(
                        post.name
                      )}
                    </div>

                    <div
                      class="postDate"
                    >
                      ${formatDate(
                        post.created_at
                      )}
                    </div>

                  </div>

                </div>


                <div
                  class="postText"
                >
                  ${escapeHtml(
                    post.text
                  )}
                </div>


                <button
                  class="yeahButton${activeClass}"
                  data-id="${post.id}"
                >

                  ${buttonText}

                  ${post.yeahs}

                </button>

              </article>

            `;

          }
        )
        .join("");


  } catch (error) {

    console.error(
      "Could not load posts:",
      error
    );

  }

}


/*
==================================================
CREATE USER
==================================================
*/

document
  .querySelector("#userForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const form =
        new FormData(
          event.target
        );


      const errorElement =
        document.querySelector(
          "#error"
        );


      errorElement.textContent =
        "";


      try {

        const response =
          await fetch(
            "/api/users",
            {
              method: "POST",

              body: form
            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          errorElement.textContent =
            data.error ||
            "Could not create user.";

          return;

        }


        /*
        Save user locally.
        */

        currentUser =
          data;


        localStorage.setItem(
          "miiverseUser",
          JSON.stringify(
            currentUser
          )
        );


        /*
        Close setup screen.
        */

        renderUser();


        /*
        Reload feed so the
        new user is recognized.
        */

        await loadPosts();


      } catch (error) {

        console.error(
          error
        );

        errorElement.textContent =
          "Could not connect to the server.";

      }

    }
  );


/*
==================================================
CREATE POST
==================================================
*/

postForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    /*
    Require a user.
    */

    if (!currentUser) {

      renderUser();

      return;

    }


    const text =
      postText.value.trim();


    if (!text) {

      return;

    }


    try {

      const response =
        await fetch(
          "/api/posts",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              userId:
                currentUser.id,

              text

            })

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        alert(
          data.error ||
          "Could not create post."
        );

        return;

      }


      /*
      Clear composer.
      */

      postText.value =
        "";

      counter.textContent =
        "0 / 500";


      /*
      Reload posts.
      */

      await loadPosts();


    } catch (error) {

      console.error(
        error
      );

      alert(
        "Could not connect to the server."
      );

    }

  }
);


/*
==================================================
CHARACTER COUNTER
==================================================
*/

postText.addEventListener(
  "input",
  () => {

    counter.textContent =
      `${postText.value.length} / 500`;

  }
);


/*
==================================================
YEAH / UNYEAH
==================================================
*/

feed.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        ".yeahButton"
      );


    if (!button) {

      return;

    }


    /*
    User must be signed in.
    */

    if (!currentUser) {

      renderUser();

      return;

    }


    const postId =
      button.dataset.id;


    try {

      /*
      Disable the button while
      the request is happening.
      */

      button.disabled =
        true;


      const response =
        await fetch(
          `/api/posts/${postId}/yeah`,
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              userId:
                currentUser.id

            })

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        alert(
          data.error ||
          "Could not change Yeah status."
        );

        return;

      }


      /*
      Reload the feed.

      The server decides whether
      the button should say Yeah!
      or Unyeah.
      */

      await loadPosts();


    } catch (error) {

      console.error(
        error
      );

      alert(
        "Could not connect to the server."
      );

    }

  }
);


/*
==================================================
CHANGE USER
==================================================
*/

changeUserButton.addEventListener(
  "click",
  () => {

    localStorage.removeItem(
      "miiverseUser"
    );


    currentUser =
      null;


    renderUser();


    /*
    Reload so Yeah states disappear
    for the previous user.
    */

    loadPosts();

  }
);


/*
==================================================
START APP
==================================================
*/

renderUser();

loadPosts();


/*
==================================================
AUTO REFRESH
==================================================

Every five seconds the feed checks
the server for new posts.
*/

setInterval(
  loadPosts,
  5000
);