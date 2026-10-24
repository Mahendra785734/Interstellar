import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createBareServer } from "@nebula-services/bare-server-node";
import chalk from "chalk";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import bareMuxNode from "@mercuryworkshop/bare-mux/node";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import mime from "mime";
import fetch from "node-fetch";
import crypto from "node:crypto";
// import { setupMasqr } from "./Masqr.js";
import config from "./config.js";

console.log(chalk.yellow("🚀 Starting server..."));

const __dirname = process.cwd();
const server = http.createServer();
const app = express();
const bareServer = createBareServer("/ca/");
const { baremuxPath } = bareMuxNode;
const epoxyDistPath = path.join(
  __dirname,
  "node_modules",
  "@mercuryworkshop",
  "epoxy-transport",
  "dist",
);
const PORT = process.env.PORT || 8080;
const cache = new Map();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // Cache for 30 Days

wisp.options.allow_loopback_ips = true;
wisp.options.allow_private_ips = true;

if (config.challenge !== false) {
  console.log(chalk.green("🔒 Server password protection is enabled."));
  app.use(basicAuth({ users: config.users, challenge: true }));
}

app.get("/e/*", async (req, res, next) => {
  try {
    if (cache.has(req.path)) {
      const { data, contentType, timestamp } = cache.get(req.path);
      if (Date.now() - timestamp > CACHE_TTL) {
        cache.delete(req.path);
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        return res.end(data);
      }
    }

    const baseUrls = {
      "/e/1/": "https://raw.githubusercontent.com/qrs/x/fixy/",
      "/e/2/": "https://raw.githubusercontent.com/3v1/V5-Assets/main/",
      "/e/3/": "https://raw.githubusercontent.com/3v1/V5-Retro/master/",
    };

    let reqTarget;
    for (const [prefix, baseUrl] of Object.entries(baseUrls)) {
      if (req.path.startsWith(prefix)) {
        reqTarget = baseUrl + req.path.slice(prefix.length);
        break;
      }
    }

    if (!reqTarget) {
      return next();
    }

    const asset = await fetch(reqTarget);
    if (!asset.ok) {
      return next();
    }

    const data = Buffer.from(await asset.arrayBuffer());
    const ext = path.extname(reqTarget);
    const no = [".unityweb"];
    const contentType = no.includes(ext) ? "application/octet-stream" : mime.getType(ext);

    cache.set(req.path, { data, contentType, timestamp: Date.now() });
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    console.error("Error fetching asset:", error);
    res.setHeader("Content-Type", "text/html");
    res.status(500).send("Error fetching the asset");
  }
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Community accounts: passwords are salted and hashed; plaintext passwords are never stored. */
const communityDataDir = path.join(__dirname, "data");
const communityUsersFile = path.join(communityDataDir, "community-users.json");
const communitySessions = new Map();
const authAttempts = new Map();
const SESSION_COOKIE = "community_session";
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

function readCommunityUsers() {
  try {
    const parsed = JSON.parse(fs.readFileSync(communityUsersFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not read community users:", error.message);
    return [];
  }
}
function saveCommunityUsers(users) {
  fs.mkdirSync(communityDataDir, { recursive: true });
  const temporaryFile = communityUsersFile + ".tmp";
  fs.writeFileSync(temporaryFile, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, communityUsersFile);
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}
function publicUser(user) {
  return { username: user.username, email: user.email, createdAt: user.createdAt };
}
function rateLimited(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = authAttempts.get(key) || { count: 0, resetAt: now + 10 * 60 * 1000 };
  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + 10 * 60 * 1000;
  }
  current.count += 1;
  authAttempts.set(key, current);
  if (current.count > 30) return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
  next();
}
function setCommunitySession(res, user, remember) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + (remember ? SESSION_TTL : 24 * 60 * 60 * 1000);
  communitySessions.set(token, { userId: user.id, expiresAt });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(res.req.secure),
    path: "/",
    maxAge: remember ? SESSION_TTL : undefined,
  });
}
function currentCommunityUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = communitySessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    communitySessions.delete(token);
    return null;
  }
  return readCommunityUsers().find(user => user.id === session.userId) || null;
}
app.set("trust proxy", 1);

app.post("/api/community/register", rateLimited, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3–20 characters and use only letters, numbers, or underscores." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const users = readCommunityUsers();
  if (users.some(user => normalizeUsername(user.username) === normalizeUsername(username))) {
    return res.status(409).json({ error: "That username is already taken. Try signing in or choose another." });
  }
  if (users.some(user => normalizeEmail(user.email) === email)) {
    return res.status(409).json({ error: "An account with that email already exists. Try signing in instead." });
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const user = {
    id: crypto.randomUUID(),
    username,
    email,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  try {
    saveCommunityUsers(users);
  } catch (error) {
    console.error("Could not save community account:", error.message);
    return res.status(500).json({ error: "Your account could not be saved. Check that the server can write to its data folder." });
  }
  setCommunitySession(res, user, Boolean(req.body?.remember));
  return res.status(201).json({ user: publicUser(user) });
});

app.post("/api/community/login", rateLimited, (req, res) => {
  const identifier = String(req.body?.identifier || "").trim();
  const password = String(req.body?.password || "");
  if (!identifier || !password) return res.status(400).json({ error: "Enter your username/email and password." });
  const users = readCommunityUsers();
  const user = users.find(item =>
    normalizeUsername(item.username) === normalizeUsername(identifier) ||
    normalizeEmail(item.email) === normalizeEmail(identifier)
  );
  // Run scrypt even for unknown users to reduce account-enumeration timing differences.
  const salt = user?.salt || "community-login-fallback-salt";
  const expected = user?.passwordHash || crypto.scryptSync("not-the-password", salt, 64).toString("hex");
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  const valid = user && actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  if (!valid) return res.status(401).json({ error: "Username/email or password doesn't match. If you're new, choose Create account." });
  setCommunitySession(res, user, Boolean(req.body?.remember));
  return res.json({ user: publicUser(user) });
});

app.get("/api/community/me", (req, res) => {
  const user = currentCommunityUser(req);
  if (!user) return res.status(401).json({ error: "You're not signed in." });
  return res.json({ user: publicUser(user) });
});

app.post("/api/community/logout", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) communitySessions.delete(token);
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: Boolean(req.secure), path: "/" });
  return res.json({ ok: true });
});


/* if (process.env.MASQR === "true") {
  console.log(chalk.green("Masqr is enabled"));
  setupMasqr(app);
} */

const transportStaticOptions = {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath);
    if (ext === ".mjs" || ext === ".js") {
      res.type("text/javascript");
    } else if (ext === ".wasm") {
      res.type("application/wasm");
    }
  },
};

app.use(express.static(path.join(__dirname, "static")));
app.use("/ca", cors({ origin: true }));
app.use("/bm", express.static(baremuxPath, transportStaticOptions));
app.use("/ep", express.static(epoxyDistPath, transportStaticOptions));

const routes = [
  { path: "/community", file: "community.html" },
  { path: "/b", file: "apps.html" },
  { path: "/a", file: "games.html" },
  { path: "/play.html", file: "games.html" },
  { path: "/c", file: "settings.html" },
  { path: "/d", file: "tabs.html" },
  { path: "/", file: "index.html" },
];

// biome-ignore lint: idk
routes.forEach(route => {
  app.get(route.path, (_req, res) => {
    res.sendFile(path.join(__dirname, "static", route.file));
  });
});

app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, "static", "404.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "static", "404.html"));
});

server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    wisp.routeRequest(req, socket, head);
  }
});

server.on("listening", () => {
  console.log(chalk.green(`🌍 Server is running on http://localhost:${PORT}`));
});

server.listen({ port: PORT });
