/**
 * Test: Document Room Manager
 *
 * Unit tests for in-memory room management (no network).
 */

const {
  DocumentRoom,
  DocumentRoomManager,
  PRESENCE_IDLE_TIMEOUT,
} = require("../lib/realtime/document-rooms");

describe("DocumentRoom", () => {
  let room;

  beforeEach(() => {
    room = new DocumentRoom("doc-123");
  });

  afterEach(() => {
    room.cleanup();
  });

  it("should add a client", () => {
    const mockWs = { readyState: 1, send: vi.fn() };
    room.addClient("client-1", mockWs, { userId: "user-1", userName: "Alice" });

    expect(room.getClientCount()).toBe(1);
    const presence = room.getPresenceList();
    expect(presence[0].clientId).toBe("client-1");
    expect(presence[0].userName).toBe("Alice");
  });

  it("should remove a client", () => {
    const mockWs = { readyState: 1, send: vi.fn() };
    room.addClient("client-1", mockWs, { userId: "user-1", userName: "Alice" });
    expect(room.getClientCount()).toBe(1);

    room.removeClient("client-1");
    expect(room.getClientCount()).toBe(0);
  });

  it("should broadcast operation to all clients except sender", () => {
    const mockWs1 = { readyState: 1, send: vi.fn() };
    const mockWs2 = { readyState: 1, send: vi.fn() };

    room.addClient("client-1", mockWs1, { userId: "user-1", userName: "Alice" });
    room.addClient("client-2", mockWs2, { userId: "user-2", userName: "Bob" });

    const op = { type: "insert", content: "hello", position: 0 };
    room.broadcastOp({ clientId: "client-1", op });

    // Only client-2 should receive the broadcast
    expect(mockWs1.send).not.toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalledOnce();

    const sentData = JSON.parse(mockWs2.send.mock.calls[0][0]);
    expect(sentData.type).toBe("remote_op");
    expect(sentData.op).toEqual(op);
  });

  it("should update presence with cursor position", () => {
    const mockWs = { readyState: 1, send: vi.fn() };
    room.addClient("client-1", mockWs, { userId: "user-1", userName: "Alice" });

    room.updatePresence("client-1", { cursorPos: 42 });

    const presence = room.getPresenceList();
    expect(presence[0].cursorPos).toBe(42);
  });

  it("should track idle status", () => {
    vi.useFakeTimers();

    const mockWs = { readyState: 1, send: vi.fn(), close: vi.fn() };
    room.addClient("client-1", mockWs, { userId: "user-1", userName: "Alice" });

    // Capture the timer ID and disable the actual eviction
    vi.clearAllTimers();

    let presence = room.getPresenceList();
    expect(presence[0].idle).toBe(false);

    // Manually set lastSeen to past (without triggering eviction timer)
    const client = room.clients.get("client-1");
    client.lastSeen = Date.now() - PRESENCE_IDLE_TIMEOUT - 1000;

    presence = room.getPresenceList();
    expect(presence[0].idle).toBe(true);

    vi.useRealTimers();
  });

  it("should report empty status correctly", () => {
    expect(room.isEmpty()).toBe(true);

    const mockWs = { readyState: 1, send: vi.fn() };
    room.addClient("client-1", mockWs, { userId: "user-1", userName: "Alice" });
    expect(room.isEmpty()).toBe(false);

    room.removeClient("client-1");
    expect(room.isEmpty()).toBe(true);
  });

  it("should handle WebSocket send errors gracefully", () => {
    const mockWs = { readyState: 1, send: vi.fn().mockImplementation(() => {
      throw new Error("Send failed");
    }) };

    room.addClient("client-1", mockWs, { userId: "user-1", userName: "Alice" });
    const mockWs2 = { readyState: 1, send: vi.fn() };
    room.addClient("client-2", mockWs2, { userId: "user-2", userName: "Bob" });

    // Should not throw
    expect(() => {
      room.broadcastOp({ clientId: "client-1", op: { content: "test" } });
    }).not.toThrow();

    expect(mockWs2.send).toHaveBeenCalled();
  });
});

describe("DocumentRoomManager", () => {
  let manager;

  beforeEach(() => {
    manager = new DocumentRoomManager();
  });

  afterEach(() => {
    manager.cleanup();
  });

  it("should create and retrieve rooms", () => {
    const room1 = manager.getRoom("doc-1");
    const room2 = manager.getRoom("doc-1");

    expect(room1).toBe(room2); // Same instance
    expect(manager.getRoomCount()).toBe(1);
  });

  it("should clean up empty rooms", () => {
    const room1 = manager.getRoom("doc-1");
    const room2 = manager.getRoom("doc-2");

    const mockWs = { readyState: 1, send: vi.fn() };
    room1.addClient("c1", mockWs, { userId: "u1", userName: "A" });

    expect(manager.getRoomCount()).toBe(2);

    manager.cleanup();

    // Only room1 should remain (room2 is empty)
    expect(manager.getRoomCount()).toBe(1);
    expect(manager.rooms.has("doc-1")).toBe(true);
    expect(manager.rooms.has("doc-2")).toBe(false);
  });

  it("should track multiple documents", () => {
    const mockWs = { readyState: 1, send: vi.fn() };

    manager.getRoom("doc-a").addClient("c1", mockWs, { userId: "u1", userName: "A" });
    manager.getRoom("doc-b").addClient("c2", mockWs, { userId: "u2", userName: "B" });
    manager.getRoom("doc-c").addClient("c3", mockWs, { userId: "u3", userName: "C" });

    expect(manager.getRoomCount()).toBe(3);
  });
});
