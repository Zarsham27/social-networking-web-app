// upload_server.mjs
// Backend for "tripTalk" – travel-themed social networking site

import dotenv from "dotenv";
dotenv.config();

console.log("DEBUG → Weather key:", JSON.stringify(process.env.OPENWEATHER_API_KEY));
console.log("DEBUG → AI key:", JSON.stringify(process.env.OPENAI_API_KEY));

import express from "express";
import session from "express-session";
import { MongoClient, ObjectId } from "mongodb";
import multer from "multer";
import fetch from "node-fetch"; // server-side HTTP client (allowed), npm install node-fetch@3

const app = express();
const PORT = 8080;

// Your student ID – used in all paths (VERY IMPORTANT for marking)
const STUDENT_ID = "M00733239";
const BASE_PATH = "/" + STUDENT_ID;

// ===============================
// 1. Express middleware
// ===============================

app.use(express.json());
app.use(express.static("public")); // serves your single-page frontend

app.use(
  session({
    secret: "change-this-secret-before-submission",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// ===============================
// 2. MongoDB setup
// ===============================

const mongoUrl = "mongodb://127.0.0.1:27017";
const client = new MongoClient(mongoUrl);
let db;

function usersCollection() {
  return db.collection("users");
}
function contentsCollection() {
  return db.collection("contents");
}
function followsCollection() {
  return db.collection("follows");
}
function likesCollection() {
  return db.collection("likes");
}
function commentsCollection() {
  return db.collection("comments");
}
function friendRequestsCollection() {
  return db.collection("friendRequests");
}

async function startServer() {
  try {
    await client.connect();
    db = client.db("cst2120");
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log("Server running on http://localhost:" + PORT + BASE_PATH);
    });
  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
  }
}
startServer();

// ===============================
// 3. Helper functions & middleware
// ===============================

function ensureLoggedIn(req, res, next) {
  if (!req.session || !req.session.username) {
    return res.status(401).json({
      error: "You must be logged in to access this resource.",
    });
  }
  next();
}

// password: at least 8 chars, 1 upper, 1 lower, 1 digit, 1 special
function isStrongPassword(password) {
  const strongPwRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
  return strongPwRegex.test(password);
}

// simple but decent email regex
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ===============================
// 4. Multer setup for image/file upload
// ===============================
// Files are stored in server file system under public/uploads

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads"); // make sure this folder exists
  },
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniquePrefix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ===============================
// 5. Test route
// ===============================

app.get(BASE_PATH + "/test", (req, res) => {
  res.json({ message: "tripTalk web service is running!" });
});

// ===============================
// 6. USERS – registration, search, profile
// Required:
//   POST /{ID}/users
//   GET  /{ID}/users?q=
// Advanced:
//   GET/PUT /{ID}/profile
// ===============================

// POST /M00733239/users  (Registration)
app.post(BASE_PATH + "/users", async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;

    if (!username || !password || !displayName || !email) {
      return res.status(400).json({
        error: "username, password, displayName and email are required.",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, a number and a special character.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Email address is not in a valid format.",
      });
    }

    const existingUser = await usersCollection().findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        error: "This username is already taken. Please choose another.",
      });
    }

    const userDoc = {
      username,
      password, // plain-text for coursework – OK but not ideal in real life
      displayName,
      email,
      bio: "",
      location: "",
      profileImageUrl: "", // can be updated when they upload profile picture
      createdAt: new Date(),
    };

    const result = await usersCollection().insertOne(userDoc);

    res.status(201).json({
      message: "User registration successful.",
      user: {
        _id: result.insertedId,
        username,
        displayName,
        email,
      },
    });
  } catch (err) {
    console.error("Error in POST /users:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// GET /M00733239/users?q=tom  (Search users)
app.get(BASE_PATH + "/users", async (req, res) => {
  try {
    const q = req.query.q;
    let filter = {};

    if (q && q.trim() !== "") {
      filter = { username: { $regex: q.trim(), $options: "i" } };
    }

    const users = await usersCollection()
      .find(filter, { projection: { password: 0 } })
      .toArray();

    res.json(users);
  } catch (err) {
    console.error("Error in GET /users:", err);
    res.status(500).json({ error: "Error fetching users." });
  }
});

// Advanced: GET /M00733239/profile  (view own profile)
app.get(BASE_PATH + "/profile", ensureLoggedIn, async (req, res) => {
  try {
    const user = await usersCollection().findOne(
      { username: req.session.username },
      { projection: { password: 0 } }
    );
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json(user);
  } catch (err) {
    console.error("Error in GET /profile:", err);
    res.status(500).json({ error: "Error fetching profile." });
  }
});

// Advanced: PUT /M00733239/profile  (edit profile)
app.put(BASE_PATH + "/profile", ensureLoggedIn, async (req, res) => {
  try {
    const { displayName, email, bio, location } = req.body;

    const update = {};
    if (displayName) update.displayName = displayName;
    if (email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format." });
      }
      update.email = email;
    }
    if (bio !== undefined) update.bio = bio;
    if (location !== undefined) update.location = location;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    await usersCollection().updateOne(
      { username: req.session.username },
      { $set: update }
    );

    const updatedUser = await usersCollection().findOne(
      { username: req.session.username },
      { projection: { password: 0 } }
    );

    res.json({
      message: "Profile updated.",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error in PUT /profile:", err);
    res.status(500).json({ error: "Error updating profile." });
  }
});

// ===============================
// 7. LOGIN – status, login, logout
// Required:
//   GET    /{ID}/login
//   POST   /{ID}/login
//   DELETE /{ID}/login
// ===============================

app.get(BASE_PATH + "/login", async (req, res) => {
  try {
    if (!req.session || !req.session.username) {
      return res.json({ loggedIn: false });
    }

    const user = await usersCollection().findOne(
      { username: req.session.username },
      { projection: { password: 0 } }
    );

    if (!user) {
      req.session.destroy(() => {});
      return res.json({ loggedIn: false });
    }

    res.json({ loggedIn: true, user });
  } catch (err) {
    console.error("Error in GET /login:", err);
    res.status(500).json({ error: "Error checking login." });
  }
});

app.post(BASE_PATH + "/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "You must provide both username and password." });
    }

    const user = await usersCollection().findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Username or password incorrect." });
    }

    req.session.username = user.username;

    res.json({
      loggedIn: true,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        location: user.location,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Error in POST /login:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

app.delete(BASE_PATH + "/login", (req, res) => {
  if (!req.session) {
    return res.json({ message: "Not logged in, but logout complete." });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Error logging out." });
    }
    res.json({ message: "Logged out successfully." });
  });
});

// ===============================
// 8. CONTENTS – post, search, feed, likes, comments
// Required:
//   POST /{ID}/contents
//   GET  /{ID}/contents?q=
//   GET  /{ID}/feed
// Advanced:
//   Likes & comments
// ===============================

// POST /M00733239/contents  (create a tripTalk post)
app.post(BASE_PATH + "/contents", ensureLoggedIn, async (req, res) => {
  try {
    const { text, imageUrl } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Content text is required." });
    }

    const contentDoc = {
      username: req.session.username,
      text: text.trim(),
      imageUrl: imageUrl || "", // optional image URL from upload
      createdAt: new Date(),
    };

    const result = await contentsCollection().insertOne(contentDoc);

    res.status(201).json({
      message: "Content posted successfully.",
      content: {
        _id: result.insertedId,
        ...contentDoc,
      },
    });
  } catch (err) {
    console.error("Error in POST /contents:", err);
    res.status(500).json({ error: "Error posting content." });
  }
});

// GET /M00733239/contents?q=beach  (search tripTalk posts)
app.get(BASE_PATH + "/contents", async (req, res) => {
  try {
    const q = req.query.q;
    let filter = {};

    if (q && q.trim() !== "") {
      filter = { text: { $regex: q.trim(), $options: "i" } };
    }

    const contents = await contentsCollection()
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(contents);
  } catch (err) {
    console.error("Error in GET /contents:", err);
    res.status(500).json({ error: "Error fetching contents." });
  }
});

// GET /M00733239/feed  (ONLY posts from followed users)
app.get(BASE_PATH + "/feed", ensureLoggedIn, async (req, res) => {
  try {
    const myUsername = req.session.username;

    // find who I follow
    const followDocs = await followsCollection()
      .find({ followerUsername: myUsername })
      .toArray();

    const followedUsernames = followDocs.map((f) => f.followeeUsername);

    if (followedUsernames.length === 0) {
      // if not following anyone, feed is empty (according to spec)
      return res.json([]);
    }

    const feedContents = await contentsCollection()
      .find({ username: { $in: followedUsernames } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(feedContents);
  } catch (err) {
    console.error("Error in GET /feed:", err);
    res.status(500).json({ error: "Error fetching feed." });
  }
});

// ===== Likes (Advanced) =====
// (Coursework does not fix path name, so you can choose a clear one)

// POST /M00733239/contents/:contentId/like
app.post(
  BASE_PATH + "/contents/:contentId/like",
  ensureLoggedIn,
  async (req, res) => {
    try {
      const { contentId } = req.params;
      let contentObjectId;
      try {
        contentObjectId = new ObjectId(contentId);
      } catch {
        return res.status(400).json({ error: "Invalid content ID." });
      }

      const existingLike = await likesCollection().findOne({
        contentId: contentObjectId,
        username: req.session.username,
      });

      if (existingLike) {
        return res.status(400).json({ error: "You already liked this post." });
      }

      await likesCollection().insertOne({
        contentId: contentObjectId,
        username: req.session.username,
        createdAt: new Date(),
      });

      res.json({ message: "Post liked." });
    } catch (err) {
      console.error("Error in POST /contents/:id/like:", err);
      res.status(500).json({ error: "Error liking post." });
    }
  }
);

// DELETE /M00733239/contents/:contentId/like
app.delete(
  BASE_PATH + "/contents/:contentId/like",
  ensureLoggedIn,
  async (req, res) => {
    try {
      const { contentId } = req.params;
      let contentObjectId;
      try {
        contentObjectId = new ObjectId(contentId);
      } catch {
        return res.status(400).json({ error: "Invalid content ID." });
      }

      const result = await likesCollection().deleteOne({
        contentId: contentObjectId,
        username: req.session.username,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Like not found." });
      }

      res.json({ message: "Like removed." });
    } catch (err) {
      console.error("Error in DELETE /contents/:id/like:", err);
      res.status(500).json({ error: "Error unliking post." });
    }
  }
);

// GET /M00733239/contents/:contentId/likes
app.get(BASE_PATH + "/contents/:contentId/likes", async (req, res) => {
  try {
    const { contentId } = req.params;
    let contentObjectId;
    try {
      contentObjectId = new ObjectId(contentId);
    } catch {
      return res.status(400).json({ error: "Invalid content ID." });
    }

    const likes = await likesCollection()
      .find({ contentId: contentObjectId })
      .toArray();

    res.json({
      count: likes.length,
      users: likes.map((l) => l.username),
    });
  } catch (err) {
    console.error("Error in GET /contents/:id/likes:", err);
    res.status(500).json({ error: "Error fetching likes." });
  }
});

// ===== Comments (Advanced) =====

// POST /M00733239/contents/:contentId/comments
app.post(
  BASE_PATH + "/contents/:contentId/comments",
  ensureLoggedIn,
  async (req, res) => {
    try {
      const { contentId } = req.params;
      const { text } = req.body;

      if (!text || text.trim() === "") {
        return res.status(400).json({ error: "Comment text is required." });
      }

      let contentObjectId;
      try {
        contentObjectId = new ObjectId(contentId);
      } catch {
        return res.status(400).json({ error: "Invalid content ID." });
      }

      const commentDoc = {
        contentId: contentObjectId,
        username: req.session.username,
        text: text.trim(),
        createdAt: new Date(),
      };

      const result = await commentsCollection().insertOne(commentDoc);

      res.status(201).json({
        message: "Comment added.",
        comment: { _id: result.insertedId, ...commentDoc },
      });
    } catch (err) {
      console.error("Error in POST /contents/:id/comments:", err);
      res.status(500).json({ error: "Error adding comment." });
    }
  }
);

// GET /M00733239/contents/:contentId/comments
app.get(BASE_PATH + "/contents/:contentId/comments", async (req, res) => {
  try {
    const { contentId } = req.params;
    let contentObjectId;
    try {
      contentObjectId = new ObjectId(contentId);
    } catch {
      return res.status(400).json({ error: "Invalid content ID." });
    }

    const comments = await commentsCollection()
      .find({ contentId: contentObjectId })
      .sort({ createdAt: 1 })
      .toArray();

    res.json(comments);
  } catch (err) {
    console.error("Error in GET /contents/:id/comments:", err);
    res.status(500).json({ error: "Error fetching comments." });
  }
});

// ===============================
// 9. FOLLOW – follow/unfollow
// Required:
//   POST   /{ID}/follow
//   DELETE /{ID}/follow
// ===============================

app.post(BASE_PATH + "/follow", ensureLoggedIn, async (req, res) => {
  try {
    const { usernameToFollow } = req.body;

    if (!usernameToFollow) {
      return res
        .status(400)
        .json({ error: "You must provide 'usernameToFollow'." });
    }

    if (usernameToFollow === req.session.username) {
      return res.status(400).json({ error: "You cannot follow yourself." });
    }

    const userToFollow = await usersCollection().findOne({
      username: usernameToFollow,
    });

    if (!userToFollow) {
      return res.status(404).json({ error: "User to follow does not exist." });
    }

    const existingFollow = await followsCollection().findOne({
      followerUsername: req.session.username,
      followeeUsername: usernameToFollow,
    });

    if (existingFollow) {
      return res.status(400).json({ error: "You already follow this user." });
    }

    const followDoc = {
      followerUsername: req.session.username,
      followeeUsername: usernameToFollow,
      createdAt: new Date(),
    };

    await followsCollection().insertOne(followDoc);

    res.json({ message: "Now following user.", follow: followDoc });
  } catch (err) {
    console.error("Error in POST /follow:", err);
    res.status(500).json({ error: "Error following user." });
  }
});

app.delete(BASE_PATH + "/follow", ensureLoggedIn, async (req, res) => {
  try {
    const { usernameToUnfollow } = req.body;

    if (!usernameToUnfollow) {
      return res
        .status(400)
        .json({ error: "You must provide 'usernameToUnfollow'." });
    }

    const result = await followsCollection().deleteOne({
      followerUsername: req.session.username,
      followeeUsername: usernameToUnfollow,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ error: "You were not following this user." });
    }

    res.json({ message: "Unfollowed user." });
  } catch (err) {
    console.error("Error in DELETE /follow:", err);
    res.status(500).json({ error: "Error unfollowing user." });
  }
});

// ===============================
// 10. Friend Requests (Advanced)
// ===============================

// POST /M00733239/friend-requests  (send request)
app.post(BASE_PATH + "/friend-requests", ensureLoggedIn, async (req, res) => {
  try {
    const { toUsername } = req.body;

    if (!toUsername) {
      return res
        .status(400)
        .json({ error: "You must provide 'toUsername'." });
    }

    if (toUsername === req.session.username) {
      return res.status(400).json({ error: "You cannot friend yourself." });
    }

    const targetUser = await usersCollection().findOne({ username: toUsername });
    if (!targetUser) {
      return res.status(404).json({ error: "User does not exist." });
    }

    const existing = await friendRequestsCollection().findOne({
      fromUsername: req.session.username,
      toUsername,
      status: "pending",
    });

    if (existing) {
      return res
        .status(400)
        .json({ error: "Friend request already pending." });
    }

    const doc = {
      fromUsername: req.session.username,
      toUsername,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await friendRequestsCollection().insertOne(doc);

    res.status(201).json({
      message: "Friend request sent.",
      request: { _id: result.insertedId, ...doc },
    });
  } catch (err) {
    console.error("Error in POST /friend-requests:", err);
    res.status(500).json({ error: "Error sending friend request." });
  }
});

// GET /M00733239/friend-requests  (incoming requests)
app.get(BASE_PATH + "/friend-requests", ensureLoggedIn, async (req, res) => {
  try {
    const requests = await friendRequestsCollection()
      .find({ toUsername: req.session.username, status: "pending" })
      .toArray();

    res.json(requests);
  } catch (err) {
    console.error("Error in GET /friend-requests:", err);
    res.status(500).json({ error: "Error fetching friend requests." });
  }
});

// POST /M00733239/friend-requests/:id/accept
app.post(
  BASE_PATH + "/friend-requests/:id/accept",
  ensureLoggedIn,
  async (req, res) => {
    try {
      const { id } = req.params;
      let requestId;
      try {
        requestId = new ObjectId(id);
      } catch {
        return res.status(400).json({ error: "Invalid request ID." });
      }

      const request = await friendRequestsCollection().findOne({
        _id: requestId,
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found." });
      }

      if (request.toUsername !== req.session.username) {
        return res
          .status(403)
          .json({ error: "You are not the recipient of this request." });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Request already handled." });
      }

      await friendRequestsCollection().updateOne(
        { _id: requestId },
        { $set: { status: "accepted", handledAt: new Date() } }
      );

      // advanced: automatically follow each other when you become friends
      await followsCollection().insertMany([
        {
          followerUsername: request.fromUsername,
          followeeUsername: request.toUsername,
          createdAt: new Date(),
        },
        {
          followerUsername: request.toUsername,
          followeeUsername: request.fromUsername,
          createdAt: new Date(),
        },
      ]);

      res.json({ message: "Friend request accepted." });
    } catch (err) {
      console.error("Error in POST /friend-requests/:id/accept:", err);
      res.status(500).json({ error: "Error accepting friend request." });
    }
  }
);

// ===============================
// 11. Image / File Upload (AJAX, server file system)
// Required for upload marks
// ===============================

// POST /M00733239/upload  (image or file)
// front-end must send FormData with field name "file"
app.post(
  BASE_PATH + "/upload",
  ensureLoggedIn,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      // file is stored in public/uploads/...
      const relativeUrl = "/uploads/" + req.file.filename;

      // Optionally, store in Mongo as part of user's "tripTalk" uploads
      // Or link it to a post later
      res.status(201).json({
        message: "File uploaded successfully.",
        fileUrl: relativeUrl,
        originalName: req.file.originalname,
      });
    } catch (err) {
      console.error("Error in POST /upload:", err);
      res.status(500).json({ error: "Error uploading file." });
    }
  }
);

// ===============================
// 12. Third-Party Data – Weather & AI chatbot
// Paths start with {ID}, all calls are server-side (OK for coursework)
// ===============================

// GET /M00733239/weather?city=London
app.get(`/${STUDENT_ID}/weather`, async (req, res) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  console.log("SERVER USING WEATHER KEY:", apiKey);   // <-- add this line

  if (!apiKey) {
    return res.status(500).json({ error: "Weather API key not configured on server." });
  }

  const city = req.query.city || "London";

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

    const fetchResp = await fetch(url);
    const data = await fetchResp.json();

    if (data.cod !== 200) {
      return res.status(400).json({ error: data.message || "Weather API returned an error." });
    }

    return res.json({
      city: data.name,
      temperature: data.main.temp,
      feels_like: data.main.feels_like,
      description: data.weather[0].description,
    });
  } catch (err) {
    console.error("Weather error:", err);
    return res.status(500).json({ error: "Server error fetching weather." });
  }
});


// POST /M00733239/chat  (AI chatbot for travel tips)
app.post(BASE_PATH + "/chat", ensureLoggedIn, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "AI API key not configured on server." });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant helping users talk about travel on a website called tripTalk. Keep answers short and friendly.",
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      return res.status(500).json({
        error: "AI API request failed.",
        details: await response.text(),
      });
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content || "Sorry, I have no reply.";

    res.json({ reply });
  } catch (err) {
    console.error("Error in POST /chat:", err);
    res.status(500).json({ error: "Error talking to AI." });
  }
});
