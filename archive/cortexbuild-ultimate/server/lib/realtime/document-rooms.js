/**
 * Real-time Document Collaboration: Room Manager
 *
 * In-memory room manager for collaborative document editing.
 * Tracks connected clients per document, broadcasts operations,
 * maintains presence info, and handles idle eviction.
 *
 * TRADE-OFFS (Documented):
 * - Last-Write-Wins: No CRDT or OT; timestamp-ordered ops resolve conflicts
 * - Optimistic Local Apply: Client applies ops immediately; server timestamp
 *   provides canonical ordering for remote replicas
 * - Presence Heartbeat: 30s idle timeout; clients must ping to stay active
 * - In-Memory: Room state lost on server restart (acceptable for collaboration)
 */

const PRESENCE_HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const PRESENCE_IDLE_TIMEOUT = 60_000; // 60 seconds (2x heartbeat)

class DocumentRoom {
  constructor(docId) {
    this.docId = docId;
    this.clients = new Map(); // Map<clientId, { ws, userId, userName, lastSeen, cursorPos }>
    this.presenceTimers = new Map(); // Map<clientId, timeoutId>
  }

  /**
   * Add a client (WebSocket connection) to the room.
   * @param {string} clientId - Unique client identifier
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} metadata - { userId, userName }
   */
  addClient(clientId, ws, metadata) {
    this.clients.set(clientId, {
      ws,
      userId: metadata.userId,
      userName: metadata.userName,
      lastSeen: Date.now(),
      cursorPos: null,
    });
    this._resetPresenceTimer(clientId);
  }

  /**
   * Remove a client from the room.
   * @param {string} clientId - Client identifier
   */
  removeClient(clientId) {
    this.clients.delete(clientId);
    this._clearPresenceTimer(clientId);
  }

  /**
   * Broadcast an operation to all clients except the sender.
   * @param {object} operation - { type, clientId, op, serverTimestamp }
   */
  broadcastOp(operation) {
    const { clientId, op, serverTimestamp } = operation;
    const payload = {
      type: "remote_op",
      op,
      serverTimestamp: serverTimestamp || Date.now(),
      clientId, // For debugging; clients can ignore
    };

    this.clients.forEach((client, cid) => {
      if (cid !== clientId && client.ws.readyState === 1) {
        // readyState 1 = OPEN
        try {
          client.ws.send(JSON.stringify(payload));
        } catch (err) {
          console.error(`[DocumentRoom] Failed to send to client ${cid}:`, err.message);
        }
      }
    });
  }

  /**
   * Update and broadcast presence (cursor positions, idle status).
   * @param {string} clientId - Client identifier
   * @param {object} presence - { cursorPos, userId, userName, ... }
   */
  updatePresence(clientId, presence) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastSeen = Date.now();
    if (presence.cursorPos !== undefined) {
      client.cursorPos = presence.cursorPos;
    }

    this._resetPresenceTimer(clientId);
    this._broadcastPresenceList();
  }

  /**
   * Get current presence list (active clients).
   * @returns {object[]} Array of { clientId, userId, userName, cursorPos, idle }
   */
  getPresenceList() {
    const now = Date.now();
    return Array.from(this.clients.entries()).map(([clientId, client]) => ({
      clientId,
      userId: client.userId,
      userName: client.userName,
      cursorPos: client.cursorPos,
      idle: now - client.lastSeen > PRESENCE_IDLE_TIMEOUT,
    }));
  }

  /**
   * Get connected client count.
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Check if room is empty (for cleanup).
   */
  isEmpty() {
    return this.clients.size === 0;
  }

  /**
   * Broadcast presence list to all connected clients.
   * @private
   */
  _broadcastPresenceList() {
    const presence = this.getPresenceList();
    const payload = {
      type: "presence_update",
      presence,
      timestamp: Date.now(),
    };

    this.clients.forEach((client) => {
      if (client.ws.readyState === 1) {
        try {
          client.ws.send(JSON.stringify(payload));
        } catch (err) {
          console.error("[DocumentRoom] Failed to broadcast presence:", err.message);
        }
      }
    });
  }

  /**
   * Reset idle timer for a client. Resets the 60-second idle eviction timer.
   * @private
   */
  _resetPresenceTimer(clientId) {
    this._clearPresenceTimer(clientId);
    const timer = setTimeout(() => {
      // Auto-remove idle clients
      const client = this.clients.get(clientId);
      if (client) {
        console.log(`[DocumentRoom ${this.docId}] Evicting idle client ${clientId}`);
        try {
          if (client.ws && typeof client.ws.close === "function") {
            client.ws.close(4000, "Idle timeout");
          }
        } catch (err) {
          console.warn(
            `[DocumentRoom] Failed to close WebSocket for ${clientId}:`,
            err.message
          );
        }
        this.removeClient(clientId);
      }
    }, PRESENCE_IDLE_TIMEOUT);

    this.presenceTimers.set(clientId, timer);
  }

  /**
   * Clear idle timer for a client.
   * @private
   */
  _clearPresenceTimer(clientId) {
    const timer = this.presenceTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.presenceTimers.delete(clientId);
    }
  }

  /**
   * Clean up all timers (for teardown).
   */
  cleanup() {
    this.presenceTimers.forEach((timer) => clearTimeout(timer));
    this.presenceTimers.clear();
    this.clients.clear();
  }
}

/**
 * Global room manager.
 */
class DocumentRoomManager {
  constructor() {
    this.rooms = new Map(); // Map<docId, DocumentRoom>
  }

  /**
   * Get or create a room for a document.
   */
  getRoom(docId) {
    if (!this.rooms.has(docId)) {
      this.rooms.set(docId, new DocumentRoom(docId));
    }
    return this.rooms.get(docId);
  }

  /**
   * Clean up empty rooms.
   */
  cleanup() {
    const toDelete = [];
    this.rooms.forEach((room, docId) => {
      if (room.isEmpty()) {
        room.cleanup();
        toDelete.push(docId);
      }
    });
    toDelete.forEach((docId) => this.rooms.delete(docId));
  }

  /**
   * Get room count (for metrics).
   */
  getRoomCount() {
    return this.rooms.size;
  }
}

module.exports = {
  DocumentRoom,
  DocumentRoomManager,
  PRESENCE_HEARTBEAT_INTERVAL,
  PRESENCE_IDLE_TIMEOUT,
};
