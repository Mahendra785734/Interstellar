// server/chat.js — WebSocket chat rooms
import { WebSocketServer } from "ws";
import db from "./db.js";

const rooms = new Map(); // room -> Set of ws clients

function getRecentMessages(room, limit = 50) {
  return db.prepare(
    "SELECT username, content, created_at FROM messages WHERE room = ? ORDER BY id DESC LIMIT ?"
  ).all(room, limit).reverse();
}

function saveMessage(room, userId, username, content) {
  db.prepare("INSERT INTO messages (room, user_id, username, content) VALUES (?, ?, ?, ?)")
    .run(room, userId, username, content);
}

function broadcast(room, msg) {
  const clients = rooms.get(room);
  if (!clients) return;
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function parseCookies(str) {
  const obj = {};
  for (const pair of str.split(";")) {
    const [k, ...v] = pair.split("=");
    if (k) obj[k.trim()] = decodeURIComponent(v.join("="));
  }
  return obj;
}

export function setupChatHTTP(app) {
  app.get("/api/chat/rooms", (_req, res) => {
    res.json({
      rooms: [
        { id: "general", name: "General" },
        { id: "tech", name: "Tech" },
        { id: "gaming", name: "Gaming" },
        { id: "music", name: "Music" },
      ],
    });
  });

  app.get("/api/chat/messages/:room", (req, res) => {
    res.json({ messages: getRecentMessages(req.params.room) });
  });
}

export function createChatWss() {
  const wss = new WebSocketServer({ noServer: true });

  return {
    handleUpgrade(req, socket, head) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname !== "/api/chat/ws") return false;

      const cookies = parseCookies(req.headers.cookie || "");
      const token = cookies["kz_session"];
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return true;
      }

      const session = db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token);
      if (!session) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return true;
      }

      const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(session.user_id);
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return true;
      }

      const room = url.searchParams.get("room") || "general";

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.user = user;
        ws.room = room;

        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);

        const history = getRecentMessages(room);
        ws.send(JSON.stringify({ type: "history", messages: history }));

        ws.on("message", (raw) => {
          let data;
          try { data = JSON.parse(raw); } catch { return; }

          if (data.type === "message" && data.content) {
            const content = String(data.content).slice(0, 500);
            saveMessage(room, user.id, user.username, content);
            broadcast(room, {
              type: "message",
              username: user.username,
              content,
              created_at: Math.floor(Date.now() / 1000),
            });
          }
        });

        ws.on("close", () => {
          const clients = rooms.get(room);
          if (clients) {
            clients.delete(ws);
            if (clients.size === 0) rooms.delete(room);
          }
        });
      });

      return true;
    },
  };
}
