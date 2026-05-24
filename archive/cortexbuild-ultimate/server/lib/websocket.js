/**
 * CortexBuild Ultimate — WebSocket Server
 * Real-time notifications, live dashboard updates, collaborative features
 */

const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

// JWT_SECRET must be set via environment variable - no fallback allowed
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    "[FATAL] JWT_SECRET environment variable is not set - refusing to start WebSocket server",
  );
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error(
    "[FATAL] JWT_SECRET must be at least 32 characters for security",
  );
  process.exit(1);
}

// Message types
const MESSAGE_TYPES = {
  NOTIFICATION: "notification",
  DASHBOARD_UPDATE: "dashboard_update",
  ALERT: "alert",
  COLLABORATION: "collaboration",
  SYSTEM: "system",
};

// Connection store
const clients = new Map(); // Map<userId, Set<WebSocket>>
const rooms = new Map(); // Map<roomId, Set<userId>>

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server to attach to
 * @param {object} [options] - Options
 * @param {boolean} [options.enabled=true] - Whether to create the WS server (FEATURE_WEBSOCKET gate)
 */
function initWebSocket(server, { enabled = true } = {}) {
  if (!enabled) {
    console.log("[WS] WebSocket feature is disabled — server not initialized");
    // Reject WS upgrade requests with HTTP 403 so the frontend can
    // distinguish "disabled" from "server error" and stop reconnecting.
    server.on("upgrade", (req, socket, head) => {
      if (req.url?.startsWith("/ws")) {
        socket.write("HTTP/1.1 403 Forbidden\r\nX-WS-Disabled: true\r\n\r\n");
        socket.destroy();
      }
    });
    return null;
  }

  const wss = new WebSocket.Server({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    console.log("[WS] New connection");

    // Authenticate connection — tries query param first (legacy), then cookie
    const token = extractToken(req.url, req.headers.cookie);
    if (!token || !verifyToken(token)) {
      ws.close(4001, "Unauthorized");
      return;
    }

    const decoded = decodeToken(token);
    if (!decoded) {
      ws.close(4001, "Invalid token");
      return;
    }
    const userId = decoded.id;
    const userRole = decoded.role;
    const userRooms = new Set();

    // Register client
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    // Auto-join user's personal room
    userRooms.add(`user:${userId}`);
    joinRoom(userId, `user:${userId}`);

    // Handle messages
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, userId, userRole, message);
      } catch (err) {
        console.error("[WS] Message parse error:", err.message);
        sendError(ws, "Invalid message format");
      }
    });

    // Handle connection close
    ws.on("close", () => {
      console.log("[WS] Connection closed");
      const userClients = clients.get(userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          clients.delete(userId);
        }
      }
      // Leave all rooms
      userRooms.forEach((room) => leaveRoom(userId, room));
    });

    // Heartbeat / keepalive — ping every 30s, expect pong within 5s
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Send welcome message
    sendToClient(ws, {
      type: MESSAGE_TYPES.SYSTEM,
      event: "connected",
      payload: {
        message: "Connected to CortexBuild real-time service",
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Heartbeat: ping all clients every 30s, drop dead connections after 3 missed pings
  const heartbeat = setInterval(() => {
    let dead = 0;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        dead++;
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
    if (dead > 0) console.log(`[WS] Removed ${dead} dead connection(s)`);
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  console.log("[WS] WebSocket server initialized on /ws");
  return wss;
}

/**
 * Extract JWT token from WebSocket URL query string (legacy) or Cookie header (preferred).
 * Supports both so existing connections don't break during rollout.
 */
function extractToken(reqUrl, cookieHeader) {
  // Try query param first (legacy backward compatibility)
  const urlObj = new URL(reqUrl, "ws://localhost");
  const queryToken = urlObj.searchParams.get("token");
  if (queryToken) return queryToken;

  // Fall back to httpOnly cookie (same pattern as HTTP API auth)
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (err) {
    console.error("[WS] Token verification failed");
    return false;
  }
}

/**
 * Decode JWT token
 */
function decodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error("[WS] Token decode error:", err.message);
    return null;
  }
}

/**
 * Send message to specific client
 */
function sendToClient(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Send message to all clients of a user
 */
function sendToUser(userId, message) {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.forEach((ws) => sendToClient(ws, message));
  }
}

/**
 * Send message to room
 */
function sendToRoom(roomId, message, excludeUserId = null) {
  const room = rooms.get(roomId);
  if (room) {
    room.forEach((userId) => {
      if (userId !== excludeUserId) {
        sendToUser(userId, message);
      }
    });
  }
}

/**
 * Broadcast to all connected clients
 */
function broadcast(message) {
  clients.forEach((userClients, userId) => {
    userClients.forEach((ws) => sendToClient(ws, message));
  });
}

/**
 * Join room
 */
function joinRoom(userId, roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(userId);
}

/**
 * Leave room
 */
function leaveRoom(userId, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(userId);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
}

/**
 * Handle incoming message
 */
function handleMessage(ws, userId, userRole, message) {
  const { type, event, payload, room } = message;

  switch (event) {
    case "join_room": {
      // Validate room format and authorize user access
      const requestedRoom = payload.room;
      const validUserRoom = `user:${userId}`;
      const isOwnUserRoom = requestedRoom === validUserRoom;

      // Users can only join their own user room or project rooms they belong to
      if (!requestedRoom || typeof requestedRoom !== "string") {
        sendToClient(ws, {
          type: MESSAGE_TYPES.ERROR,
          event: "room_join_failed",
          payload: { reason: "invalid_room" },
        });
        break;
      }

      // Allow user-specific rooms and valid project rooms (format: project:<id>)
      const isProjectRoom = /^project:\d+$/.test(requestedRoom);
      const isAllowed = isOwnUserRoom || isProjectRoom;

      if (!isAllowed) {
        console.warn(
          `[WS] User ${userId} denied access to room ${requestedRoom}`,
        );
        sendToClient(ws, {
          type: MESSAGE_TYPES.ERROR,
          event: "room_join_failed",
          payload: { reason: "unauthorized_room" },
        });
        break;
      }

      joinRoom(userId, requestedRoom);
      sendToClient(ws, {
        type: MESSAGE_TYPES.SYSTEM,
        event: "room_joined",
        payload: { room: requestedRoom },
      });
      break;
    }

    case "leave_room":
      leaveRoom(userId, payload.room);
      sendToClient(ws, {
        type: MESSAGE_TYPES.SYSTEM,
        event: "room_left",
        payload: { room: payload.room },
      });
      break;

    case "send_notification":
      // Send notification to specific user or room
      if (payload.userId) {
        sendToUser(payload.userId, {
          type: MESSAGE_TYPES.NOTIFICATION,
          event: "notification",
          payload: {
            from: userId,
            ...payload.data,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (payload.room) {
        sendToRoom(payload.room, {
          type: MESSAGE_TYPES.NOTIFICATION,
          event: "notification",
          payload: {
            from: userId,
            ...payload.data,
            timestamp: new Date().toISOString(),
          },
        });
      }
      break;

    case "broadcast":
      if (!["super_admin", "company_owner", "admin"].includes(userRole)) {
        sendError(ws, "Insufficient permissions to broadcast");
        break;
      }
      broadcast({
        type: MESSAGE_TYPES.SYSTEM,
        event: "broadcast",
        payload: {
          from: userId,
          ...payload,
          timestamp: new Date().toISOString(),
        },
      });
      break;

    default:
      sendError(ws, `Unknown event: ${event}`);
  }
}

/**
 * Send error message
 */
function sendError(ws, errorMessage) {
  sendToClient(ws, {
    type: MESSAGE_TYPES.SYSTEM,
    event: "error",
    payload: { message: errorMessage },
  });
}

/**
 * Create notification helper
 */
function createNotification(
  userId,
  title,
  description,
  severity = "info",
  data = {},
) {
  sendToUser(userId, {
    type: MESSAGE_TYPES.NOTIFICATION,
    event: "notification",
    payload: {
      title,
      description,
      severity,
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Create alert helper (high priority notification)
 */
function createAlert(userId, title, description, data = {}) {
  sendToUser(userId, {
    type: MESSAGE_TYPES.ALERT,
    event: "alert",
    payload: {
      title,
      description,
      priority: "high",
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Dashboard update helper
 */
function sendDashboardUpdate(userId, updates) {
  sendToUser(userId, {
    type: MESSAGE_TYPES.DASHBOARD_UPDATE,
    event: "dashboard_update",
    payload: {
      updates,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Project room helpers
 */
function createProjectRoom(projectId, userId) {
  joinRoom(userId, `project:${projectId}`);
}

function notifyProjectTeam(
  projectId,
  title,
  description,
  excludeUserId = null,
) {
  sendToRoom(
    `project:${projectId}`,
    {
      type: MESSAGE_TYPES.COLLABORATION,
      event: "project_notification",
      payload: {
        projectId,
        title,
        description,
        timestamp: new Date().toISOString(),
      },
    },
    excludeUserId,
  );
}

// Export for use in routes
module.exports = {
  initWebSocket,
  createNotification,
  createAlert,
  sendDashboardUpdate,
  createProjectRoom,
  notifyProjectTeam,
  broadcast,
  MESSAGE_TYPES,
};
