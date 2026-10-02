// server/auth.js — authentication: register, login, logout, session
import crypto from "node:crypto";
import db from "./db.js";

const SESSION_COOKIE = "kz_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// In-memory rate limiter
const rateMap = new Map();
function rateLimit(ip, max, windowMs) {
  const now = Date.now();
  const key = `auth:${ip}`;
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

function createSession(userId) {
  const token = crypto.randomUUID();
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

function getSessionUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token);
  if (!session) return null;
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(session.user_id);
  return user || null;
}

export function authMiddleware(req, res, next) {
  req.user = getSessionUser(req);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

export function setupAuth(app) {
  app.post("/api/auth/register", (req, res) => {
    const ip = req.ip;
    if (!rateLimit(ip, 5, 60_000)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }

    const { username, password } = req.body;
    if (!username || typeof username !== "string" || username.length < 4 || username.length > 12) {
      return res.status(400).json({ error: "Username must be 4–12 characters." });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores." });
    }

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
      return res.status(409).json({ error: "Username already taken." });
    }

    const result = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hashPassword(password));
    const token = createSession(result.lastInsertRowid);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: SESSION_MAX_AGE * 1000,
    });
    res.json({ ok: true, username });
  });

  app.post("/api/auth/login", (req, res) => {
    const ip = req.ip;
    if (!rateLimit(ip, 10, 60_000)) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required." });
    }

    const user = db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").get(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = createSession(user.id);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: SESSION_MAX_AGE * 1000,
    });
    res.json({ ok: true, username: user.username });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    }
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (req, res) => {
    const user = getSessionUser(req);
    if (user) {
      res.json({ authenticated: true, username: user.username });
    } else {
      res.json({ authenticated: false });
    }
  });
}
