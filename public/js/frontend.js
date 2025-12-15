// ===============================
// 1. Constants and small helpers
// ===============================

// I use my student ID in every path – this is required by the coursework rules.
const STUDENT_ID = "M00733239";
const BASE_PATH = `/${STUDENT_ID}`; // e.g. "/M00733239"

// I keep track of which section of the single page is currently visible.
let currentSectionId = "auth-section";

/**
 * I show one section (by id) and hide all the others.
 * Every section in my HTML has the class "page-section".
 */
function showSection(sectionId) {
  currentSectionId = sectionId;

  document.querySelectorAll(".page-section").forEach((sec) => {
    sec.classList.remove("active");
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add("active");
  }
}

/**
 * I enable or disable the navigation buttons that require a logged-in user.
 * This is used after login/logout so I don’t accidentally open sections that need a session.
 */
function setNavEnabled(isLoggedIn) {
  document.querySelectorAll(".requires-login[data-section]").forEach((btn) => {
    btn.disabled = !isLoggedIn;
  });
}

/**
 * I show a text message (success or error) in a message <div>.
 * The CSS uses .messages.error or .messages.success to style it.
 */
function showMessage(targetElementId, message, isError = false) {
  const el = document.getElementById(targetElementId);
  if (!el) return;

  el.textContent = message || "";

  el.classList.remove("error", "success");
  if (message) {
    el.classList.add(isError ? "error" : "success");
  }
}

/**
 * I convert a date string or Date object into a comfortable local string.
 */
function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

/**
 * I safely read JSON from a fetch() response, even if it fails.
 */
async function safeJson(response) {
  try {
    return await response.json();
  } catch (err) {
    return {};
  }
}

// ===============================
// 2. Current user + navigation
// ===============================

/**
 * I update the top-right "current user" panel and the Profile section.
 * I call this after login, logout, and when I check the login status on page load.
 */
function updateCurrentUserView(loginInfo) {
  const textEl = document.getElementById("current-user-text");
  const logoutBtn = document.getElementById("logout-button");

  if (!textEl || !logoutBtn) return;

  if (loginInfo && loginInfo.loggedIn && loginInfo.user) {
    const u = loginInfo.user;

    textEl.textContent = `Logged in as: ${u.username}`;
    logoutBtn.disabled = false;
    setNavEnabled(true);

    // I update the profile section details
    const firstLetter = (u.username || "?")[0].toUpperCase();
    const avatar = document.getElementById("profile-avatar");
    if (avatar) {
      avatar.textContent = firstLetter;
    }

    const usernameEl = document.getElementById("profile-username");
    const displayNameEl = document.getElementById("profile-displayname");
    const emailEl = document.getElementById("profile-email");
    const bioEl = document.getElementById("profile-bio");
    const locationEl = document.getElementById("profile-location");

    if (usernameEl) usernameEl.textContent = u.username || "—";
    if (displayNameEl) displayNameEl.textContent = u.displayName || "—";
    if (emailEl) emailEl.textContent = u.email || "—";
    if (bioEl) bioEl.textContent = u.bio || "—";
    if (locationEl) locationEl.textContent = u.location || "—";

    // If I am currently on the Account section and I log in,
    // I move straight to the home feed so the site feels responsive.
    if (currentSectionId === "auth-section") {
      showSection("home-section");
      loadFeed();
    }
  } else {
    textEl.textContent = "Not logged in";
    logoutBtn.disabled = true;
    setNavEnabled(false);
    showSection("auth-section");
  }
}

/**
 * I wire up the navigation bar so each button shows the correct section.
 */
function setupNavigation() {
  document.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;
      if (!target) return;

      // For buttons that require login, I rely on the disabled state.
      if (btn.classList.contains("requires-login") && btn.disabled) {
        return;
      }

      showSection(target);

      // When I open certain sections, I automatically refresh their data:
      if (target === "home-section") {
        loadFeed();
      } else if (target === "profile-section") {
        loadProfile();
      } else if (target === "friends-section") {
        loadIncomingFriendRequests();
      }
    });
  });

  // At first, I only show the Account section and disable nav.
  setNavEnabled(false);
  showSection("auth-section");
}

// ===============================
// 3. Auth: register, login, logout
// ===============================

/**
 * I set up the register, login and logout forms/buttons.
 */
function setupAuthHandlers() {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");

  // --- Register ---
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = document
        .getElementById("register-username")
        .value.trim();
      const password = document.getElementById("register-password").value;
      const displayName = document
        .getElementById("register-displayname")
        .value.trim();
      const email = document.getElementById("register-email").value.trim();

      try {
        const response = await fetch(`${BASE_PATH}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, displayName, email }),
        });

        const data = await safeJson(response);

        if (!response.ok) {
          showMessage(
            "auth-messages",
            data.error || "Registration failed.",
            true
          );
        } else {
          showMessage(
            "auth-messages",
            "I registered successfully. I can now log in.",
            false
          );
          registerForm.reset();
        }
      } catch (err) {
        console.error("Error during registration:", err);
        showMessage(
          "auth-messages",
          "Something went wrong registering.",
          true
        );
      }
    });
  }

  // --- Login ---
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;

      try {
        const response = await fetch(`${BASE_PATH}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await safeJson(response);

        if (!response.ok) {
          showMessage("auth-messages", data.error || "Login failed.", true);
          updateCurrentUserView(null);
        } else {
          showMessage("auth-messages", "I logged in successfully!", false);
          updateCurrentUserView({
            loggedIn: true,
            user: data.user,
          });
        }
      } catch (err) {
        console.error("Error during login:", err);
        showMessage(
          "auth-messages",
          "Something went wrong logging in.",
          true
        );
      }
    });
  }

  // --- Logout ---
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        const response = await fetch(`${BASE_PATH}/login`, {
          method: "DELETE",
        });
        const data = await safeJson(response);

        showMessage(
          "auth-messages",
          data.message || "I logged out.",
          false
        );
        updateCurrentUserView(null);
      } catch (err) {
        console.error("Error during logout:", err);
        showMessage(
          "auth-messages",
          "Something went wrong logging out.",
          true
        );
      }
    });
  }
}

/**
 * On page load I ask the server whether I am already logged in.
 * This allows my session cookie to keep me logged in across refreshes.
 */
async function checkCurrentLogin() {
  try {
    const response = await fetch(`${BASE_PATH}/login`);
    if (!response.ok) {
      updateCurrentUserView(null);
      return;
    }
    const data = await safeJson(response);
    updateCurrentUserView(data);
  } catch (err) {
    console.error("Error checking login status:", err);
    updateCurrentUserView(null);
  }
}

// ===============================
// 4. Posting contents + feed + likes + comments
// ===============================

/**
 * I set up the "Post" form.
 * If the user attaches an image, I first upload the file to /upload,
 * then I create the content with the returned image URL.
 */
function setupPostHandler() {
  const postForm = document.getElementById("post-form");
  if (!postForm) return;

  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = document.getElementById("post-text").value.trim();
    const fileInput = document.getElementById("post-image");

    if (!text) {
      showMessage("post-messages", "I must enter some text for my post.", true);
      return;
    }

    showMessage("post-messages", "Posting your trip update...", false);

    try {
      let imageUrl = "";

      // If a file is selected, I upload it using FormData
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        const uploadResponse = await fetch(`${BASE_PATH}/upload`, {
          method: "POST",
          body: formData,
        });

        const uploadData = await safeJson(uploadResponse);

        if (!uploadResponse.ok) {
          showMessage(
            "post-messages",
            uploadData.error || "Photo upload failed.",
            true
          );
          return;
        }

        imageUrl = uploadData.fileUrl || "";
      }

      // I now create the content post with text + optional imageUrl
      const response = await fetch(`${BASE_PATH}/contents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageUrl }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        showMessage(
          "post-messages",
          data.error || "Posting failed.",
          true
        );
        return;
      }

      showMessage(
        "post-messages",
        "I posted my trip update successfully!",
        false
      );
      postForm.reset();
      loadFeed();
    } catch (err) {
      console.error("Error posting content:", err);
      showMessage(
        "post-messages",
        "Something went wrong posting content.",
        true
      );
    }
  });
}

/**
 * I attach a click handler so that when I press "Refresh feed" the feed reloads.
 */
function setupFeedHandler() {
  const btn = document.getElementById("refresh-feed-button");
  if (!btn) return;
  btn.addEventListener("click", loadFeed);
}

/**
 * I fetch the logged-in user's feed from GET /{ID}/feed.
 * The backend returns an array of posts from followed users.
 * For each post I also attach like and comment UI.
 */
async function loadFeed() {
  const container = document.getElementById("feed-contents");
  if (!container) return;

  container.innerHTML = "";
  showMessage("feed-messages", "");

  try {
    const response = await fetch(`${BASE_PATH}/feed`);
    const data = await safeJson(response);

    if (!response.ok) {
      showMessage(
        "feed-messages",
        data.error || "Failed to load feed.",
        true
      );
      return;
    }

    const contentsArray = Array.isArray(data) ? data : data.contents || [];

    if (contentsArray.length === 0) {
      container.innerHTML =
        "<p>No posts in your feed yet. Follow someone or create a post!</p>";
      return;
    }

    contentsArray.forEach((item) => {
      const postEl = buildPostElement(item, true);
      container.appendChild(postEl);
    });
  } catch (err) {
    console.error("Error loading feed:", err);
    showMessage(
      "feed-messages",
      "Something went wrong loading feed.",
      true
    );
  }
}

/**
 * I create the DOM structure for a single post,
 * including likes and comments if showInteractions is true.
 */
function buildPostElement(item, showInteractions = false) {
  const div = document.createElement("div");
  div.className = "post";
  div.dataset.postId = item._id;

  // Title line – I just use the first 60 chars of the text for a mini "title".
  const titleEl = document.createElement("div");
  titleEl.className = "post-title";
  const rawText = item.text || "";
  titleEl.textContent =
    rawText.length > 60 ? rawText.slice(0, 60) + "..." : rawText || "(No text)";
  div.appendChild(titleEl);

  // Meta line
  const metaEl = document.createElement("div");
  metaEl.className = "post-meta";
  const dateText = formatDate(item.createdAt);
  metaEl.textContent = `By ${item.username || "Unknown"} • ${dateText}`;
  div.appendChild(metaEl);

  // Full text
  const textEl = document.createElement("div");
  textEl.textContent = item.text || "";
  div.appendChild(textEl);

  // Optional image
  if (item.imageUrl) {
    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = "Trip photo";
    div.appendChild(img);
  }

  if (showInteractions) {
    const interactionBar = document.createElement("div");
    interactionBar.style.marginTop = "0.4rem";

    // Likes
    const likeBtn = document.createElement("button");
    likeBtn.className = "secondary-btn";
    likeBtn.textContent = "♥ Like";
    likeBtn.style.marginRight = "0.5rem";

    const likeCount = document.createElement("span");
    likeCount.textContent = "…";
    likeCount.className = "post-like-count";

    likeBtn.addEventListener("click", () => {
      toggleLike(item._id, likeCount);
    });

    interactionBar.appendChild(likeBtn);
    interactionBar.appendChild(likeCount);

    div.appendChild(interactionBar);

    // Comments container
    const commentsWrapper = document.createElement("div");
    commentsWrapper.style.marginTop = "0.5rem";

    const showCommentsBtn = document.createElement("button");
    showCommentsBtn.className = "secondary-btn";
    showCommentsBtn.textContent = "Show comments";
    showCommentsBtn.style.marginBottom = "0.3rem";

    const commentsList = document.createElement("div");
    commentsList.className = "comments-list";

    const commentForm = document.createElement("form");
    commentForm.className = "form-inline";
    commentForm.style.marginTop = "0.4rem";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Add a comment...";
    input.required = true;
    input.style.flex = "1";

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "secondary-btn";
    submitBtn.textContent = "Post";

    commentForm.appendChild(input);
    commentForm.appendChild(submitBtn);

    showCommentsBtn.addEventListener("click", () => {
      loadComments(item._id, commentsList);
    });

    commentForm.addEventListener("submit", (evt) => {
      evt.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      postComment(item._id, text, commentsList, input);
    });

    commentsWrapper.appendChild(showCommentsBtn);
    commentsWrapper.appendChild(commentsList);
    commentsWrapper.appendChild(commentForm);

    div.appendChild(commentsWrapper);

    // Initially load like count
    loadLikeCount(item._id, likeCount);
  }

  return div;
}

/**
 * I ask the backend how many likes a post has.
 */
async function loadLikeCount(postId, targetSpan) {
  try {
    const response = await fetch(`${BASE_PATH}/likes?postId=${postId}`);
    const data = await safeJson(response);

    if (!response.ok) {
      targetSpan.textContent = "0 likes";
      return;
    }

    const count = data.count ?? 0;
    targetSpan.textContent =
      count === 1 ? "1 like" : `${count} likes`;
  } catch (err) {
    console.error("Error loading like count:", err);
    targetSpan.textContent = "0 likes";
  }
}

/**
 * I toggle a like on or off for a post.
 * For simplicity I always try a "like" first, and if it fails with "already liked"
 * I then send an "unlike".
 */
async function toggleLike(postId, targetSpan) {
  try {
    const response = await fetch(`${BASE_PATH}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });

    const data = await safeJson(response);

    if (!response.ok && data.error && data.error.includes("already")) {
      // If backend tells me I already liked, I try to remove the like.
      const delResponse = await fetch(`${BASE_PATH}/likes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      await safeJson(delResponse);
    }

    // After like/unlike I refresh the like count.
    await loadLikeCount(postId, targetSpan);
  } catch (err) {
    console.error("Error toggling like:", err);
  }
}

/**
 * I fetch comments for a particular post and display them under the post.
 */
async function loadComments(postId, container) {
  container.innerHTML = "Loading comments...";

  try {
    const response = await fetch(`${BASE_PATH}/comments?postId=${postId}`);
    const data = await safeJson(response);

    if (!response.ok) {
      container.textContent = data.error || "Failed to load comments.";
      return;
    }

    const comments = Array.isArray(data) ? data : data.comments || [];

    if (comments.length === 0) {
      container.textContent = "No comments yet.";
      return;
    }

    container.innerHTML = "";
    comments.forEach((comment) => {
      const cDiv = document.createElement("div");
      cDiv.className = "comment";

      const meta = document.createElement("div");
      meta.className = "post-meta";
      meta.textContent = `${comment.username} • ${formatDate(
        comment.createdAt
      )}`;
      cDiv.appendChild(meta);

      const text = document.createElement("div");
      text.textContent = comment.text || "";
      cDiv.appendChild(text);

      container.appendChild(cDiv);
    });
  } catch (err) {
    console.error("Error loading comments:", err);
    container.textContent = "Something went wrong loading comments.";
  }
}

/**
 * I send a new comment to the backend and refresh the comment list afterwards.
 */
async function postComment(postId, text, container, inputEl) {
  try {
    const response = await fetch(`${BASE_PATH}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, text }),
    });

    const data = await safeJson(response);

    if (!response.ok) {
      console.error("Error posting comment:", data.error);
      return;
    }

    inputEl.value = "";
    loadComments(postId, container);
  } catch (err) {
    console.error("Error posting comment:", err);
  }
}

// ===============================
// 5. Search users + follow
// ===============================

/**
 * I set up the user search form and send the search term to GET /users?q=...
 */
function setupUserSearchHandler() {
  const form = document.getElementById("user-search-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const term = document.getElementById("user-search-term").value.trim();
    await loadUserSearchResults(term);
  });
}

/**
 * I load user search results from the backend.
 * The backend actually does the query using ?q=.
 */
async function loadUserSearchResults(term) {
  const listEl = document.getElementById("user-search-results");
  if (!listEl) return;

  listEl.innerHTML = "";
  showMessage("follow-messages", "");

  try {
    const url = `${BASE_PATH}/users?q=${encodeURIComponent(term || "")}`;
    const response = await fetch(url);
    const data = await safeJson(response);

    if (!response.ok) {
      showMessage(
        "follow-messages",
        data.error || "User search failed.",
        true
      );
      return;
    }

    const usersArray = Array.isArray(data) ? data : data.users || [];

    if (usersArray.length === 0) {
      listEl.innerHTML = "<li>No matching users found.</li>";
      return;
    }

    usersArray.forEach((user) => {
      const li = document.createElement("li");

      const infoSpan = document.createElement("span");
      infoSpan.textContent =
        user.displayName && user.displayName !== user.username
          ? `${user.displayName} (@${user.username})`
          : user.username;
      li.appendChild(infoSpan);

      const followBtn = document.createElement("button");
      followBtn.className = "secondary-btn";
      followBtn.textContent = "Follow";
      followBtn.addEventListener("click", () => {
        followUser(user.username);
      });

      li.appendChild(followBtn);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("Error searching users:", err);
    showMessage(
      "follow-messages",
      "Something went wrong searching users.",
      true
    );
  }
}

/**
 * I send a follow request to POST /follow.
 */
async function followUser(usernameToFollow) {
  try {
    const response = await fetch(`${BASE_PATH}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameToFollow }),
    });

    const data = await safeJson(response);

    if (!response.ok) {
      showMessage(
        "follow-messages",
        data.error || "Follow failed.",
        true
      );
      return;
    }

    showMessage(
      "follow-messages",
      `I am now following ${usernameToFollow}.`,
      false
    );
  } catch (err) {
    console.error("Error following user:", err);
    showMessage(
      "follow-messages",
      "Something went wrong following user.",
      true
    );
  }
}

// ===============================
// 6. Search posts (back-end search)
// ===============================

/**
 * I wire up the "Search posts" form so it calls GET /contents?q=...
 */
function setupContentSearchHandler() {
  const form = document.getElementById("content-search-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const term = document.getElementById("content-search-term").value.trim();
    await loadContentSearchResults(term);
  });
}

/**
 * I ask the backend to search posts for me using the query parameter q.
 */
async function loadContentSearchResults(term) {
  const container = document.getElementById("content-search-results");
  if (!container) return;

  container.innerHTML = "";
  showMessage("content-search-messages", "");

  try {
    const url = `${BASE_PATH}/contents?q=${encodeURIComponent(term || "")}`;
    const response = await fetch(url);
    const data = await safeJson(response);

    if (!response.ok) {
      showMessage(
        "content-search-messages",
        data.error || "Search failed.",
        true
      );
      return;
    }

    const contentsArray = Array.isArray(data) ? data : data.contents || [];

    if (contentsArray.length === 0) {
      container.innerHTML = "<p>No matching posts found.</p>";
      return;
    }

    contentsArray.forEach((item) => {
      // Here I show the same kind of card as in the feed,
      // including likes and comments, so the site feels consistent.
      const postEl = buildPostElement(item, true);
      container.appendChild(postEl);
    });
  } catch (err) {
    console.error("Error searching contents:", err);
    showMessage(
      "content-search-messages",
      "Something went wrong with search.",
      true
    );
  }
}

// ===============================
// 7. Profile view, edit and picture upload
// ===============================

/**
 * I load the current user's profile from GET /profile.
 */
async function loadProfile() {
  try {
    const response = await fetch(`${BASE_PATH}/profile`);
    const data = await safeJson(response);

    if (!response.ok) {
      showMessage(
        "profile-messages",
        data.error || "Could not load profile.",
        true
      );
      return;
    }

    // The backend returns the user object directly.
    const u = data;

    const usernameEl = document.getElementById("profile-username");
    const displayNameEl = document.getElementById("profile-displayname");
    const emailEl = document.getElementById("profile-email");
    const bioEl = document.getElementById("profile-bio");
    const locationEl = document.getElementById("profile-location");
    const avatar = document.getElementById("profile-avatar");

    if (usernameEl) usernameEl.textContent = u.username || "—";
    if (displayNameEl) displayNameEl.textContent = u.displayName || "—";
    if (emailEl) emailEl.textContent = u.email || "—";
    if (bioEl) bioEl.textContent = u.bio || "—";
    if (locationEl) locationEl.textContent = u.location || "—";

    if (avatar) {
      const firstLetter = (u.username || "?")[0].toUpperCase();
      avatar.textContent = firstLetter;
    }

    // I also pre-fill the edit form with the current values
    const editDisplayName = document.getElementById("edit-displayname");
    const editEmail = document.getElementById("edit-email");
    const editBio = document.getElementById("edit-bio");
    const editLocation = document.getElementById("edit-location");

    if (editDisplayName) editDisplayName.value = u.displayName || "";
    if (editEmail) editEmail.value = u.email || "";
    if (editBio) editBio.value = u.bio || "";
    if (editLocation) editLocation.value = u.location || "";
  } catch (err) {
    console.error("Error loading profile:", err);
    showMessage(
      "profile-messages",
      "Something went wrong loading profile.",
      true
    );
  }
}

/**
 * I set up the Edit Profile form and the Profile Picture upload form.
 */
function setupProfileHandlers() {
  const editForm = document.getElementById("profile-edit-form");
  const pictureForm = document.getElementById("profile-picture-form");

  // --- Edit profile details ---
  if (editForm) {
    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const displayName = document
        .getElementById("edit-displayname")
        .value.trim();
      const email = document.getElementById("edit-email").value.trim();
      const bio = document.getElementById("edit-bio").value.trim();
      const location = document.getElementById("edit-location").value.trim();

      // I only send values that the user has actually entered.
      const body = {};
      if (displayName) body.displayName = displayName;
      if (email) body.email = email;
      if (bio || bio === "") body.bio = bio;
      if (location || location === "") body.location = location;

      try {
        const response = await fetch(`${BASE_PATH}/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await safeJson(response);

        if (!response.ok) {
          showMessage(
            "profile-messages",
            data.error || "Profile update failed.",
            true
          );
          return;
        }

        showMessage(
          "profile-messages",
          "Profile updated successfully.",
          false
        );

        // After updating I refresh the profile display.
        loadProfile();
      } catch (err) {
        console.error("Error updating profile:", err);
        showMessage(
          "profile-messages",
          "Something went wrong updating profile.",
          true
        );
      }
    });
  }

  // --- Profile picture upload ---
  if (pictureForm) {
    pictureForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const fileInput = document.getElementById("profile-picture-input");
      if (!fileInput.files || fileInput.files.length === 0) {
        showMessage(
          "profile-messages",
          "I must choose a picture file first.",
          true
        );
        return;
      }

      const formData = new FormData();
      formData.append("file", fileInput.files[0]);

      try {
        const response = await fetch(`${BASE_PATH}/profile-picture`, {
          method: "POST",
          body: formData,
        });

        const data = await safeJson(response);

        if (!response.ok) {
          showMessage(
            "profile-messages",
            data.error || "Profile picture upload failed.",
            true
          );
          return;
        }

        showMessage(
          "profile-messages",
          "Profile picture updated successfully.",
          false
        );

        // I could update the avatar here if the backend stores the URL,
        // but for now I just reload the profile.
        loadProfile();
      } catch (err) {
        console.error("Error uploading profile picture:", err);
        showMessage(
          "profile-messages",
          "Something went wrong uploading picture.",
          true
        );
      }
    });
  }
}

// ===============================
// 8. Friend requests
// ===============================

/**
 * I set up the Friend Request form.
 */
function setupFriendRequestHandlers() {
  const form = document.getElementById("friend-request-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document
      .getElementById("friend-request-username")
      .value.trim();

    if (!username) return;

    try {
      const response = await fetch(`${BASE_PATH}/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        alert(data.error || "Friend request failed.");
        return;
      }

      alert(`Friend request sent to ${username}.`);
      form.reset();
      loadIncomingFriendRequests();
    } catch (err) {
      console.error("Error sending friend request:", err);
      alert("Something went wrong sending friend request.");
    }
  });
}

/**
 * I load incoming friend requests from GET /friends/requests
 * and show them with "Accept" buttons.
 */
async function loadIncomingFriendRequests() {
  const listEl = document.getElementById("incoming-friend-requests");
  if (!listEl) return;

  listEl.innerHTML = "<li>Loading...</li>";

  try {
    const response = await fetch(`${BASE_PATH}/friends/requests`);
    const data = await safeJson(response);

    if (!response.ok) {
      listEl.innerHTML =
        "<li>Could not load friend requests.</li>";
      return;
    }

    const requests = Array.isArray(data) ? data : data.requests || [];

    if (requests.length === 0) {
      listEl.innerHTML = "<li>No incoming friend requests.</li>";
      return;
    }

    listEl.innerHTML = "";
    requests.forEach((req) => {
      const li = document.createElement("li");
      li.textContent = `From ${req.fromUsername}`;

      const acceptBtn = document.createElement("button");
      acceptBtn.className = "secondary-btn";
      acceptBtn.textContent = "Accept";
      acceptBtn.style.marginLeft = "0.5rem";

      acceptBtn.addEventListener("click", () => {
        acceptFriendRequest(req.fromUsername);
      });

      li.appendChild(acceptBtn);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading friend requests:", err);
    listEl.innerHTML =
      "<li>Something went wrong loading friend requests.</li>";
  }
}

/**
 * I send a request to accept a friend request.
 */
async function acceptFriendRequest(username) {
  try {
    const response = await fetch(`${BASE_PATH}/friends/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await safeJson(response);

    if (!response.ok) {
      alert(data.error || "Could not accept friend request.");
      return;
    }

    alert(`You are now friends with ${username}.`);
    loadIncomingFriendRequests();
  } catch (err) {
    console.error("Error accepting friend request:", err);
    alert("Something went wrong accepting friend request.");
  }
}

// ===============================
// 9. Weather (third-party via backend)
// ===============================

/**
 * I set up the weather form so it calls GET /weather?city=...
 */
function setupWeatherHandlers() {
  const form = document.getElementById("weather-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const city = document.getElementById("weather-city").value.trim() || "London";

    const resultEl = document.getElementById("weather-result");
    resultEl.textContent = "Loading weather...";

    try {
      const response = await fetch(
        `${BASE_PATH}/weather?city=${encodeURIComponent(city)}`
      );
      const data = await safeJson(response);

      if (!response.ok) {
        resultEl.textContent =
          data.error || "Could not fetch weather information.";
        return;
      }

      resultEl.innerHTML = `
        <h4>${data.city}</h4>
        <p>${data.description}</p>
        <p><strong>${data.temperature}°C</strong> (feels like ${data.feels_like}°C)</p>
      `;
    } catch (err) {
      console.error("Error loading weather:", err);
      resultEl.textContent = "Something went wrong loading weather.";
    }
  });
}

// ===============================
// 10. AI Chat – talk to the backend
// ===============================

/**
 * I set up the AI chat form. When I submit a message, I POST it to /chat
 * and show the AI's reply.
 */
function setupChatHandlers() {
  const form = document.getElementById("chat-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    const responseEl = document.getElementById("chat-response");

    if (!message) return;

    responseEl.textContent = "Thinking...";
    try {
      const response = await fetch(`${BASE_PATH}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        responseEl.textContent =
          data.error || "AI could not respond right now.";
        return;
      }

      responseEl.textContent = data.reply || "I have no reply.";
      input.value = "";
    } catch (err) {
      console.error("Error talking to AI:", err);
      responseEl.textContent = "Something went wrong talking to AI.";
    }
  });
}

// ===============================
// 11. Initialise everything on page load
// ===============================

window.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupAuthHandlers();

  setupPostHandler();
  setupFeedHandler();

  setupUserSearchHandler();
  setupContentSearchHandler();

  setupProfileHandlers();
  setupFriendRequestHandlers();
  setupWeatherHandlers();
  setupChatHandlers();

  checkCurrentLogin();
});