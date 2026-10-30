"use strict";
var CortexCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // packages/core/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    CAPABILITIES: () => CAPABILITIES,
    CORTEX_ROLES: () => CORTEX_ROLES,
    api: () => api,
    assertCapability: () => assertCapability,
    capabilitiesFor: () => capabilitiesFor,
    createApiClient: () => createApiClient,
    discardLegacyWrites: () => discardLegacyWrites,
    exportLegacyWrites: () => exportLegacyWrites,
    flushQueue: () => flushQueue,
    hasCapability: () => hasCapability,
    legacyPendingWrites: () => legacyPendingWrites,
    onQueueChange: () => onQueueChange,
    onStreamEvent: () => onStreamEvent,
    pendingWrites: () => pendingWrites,
    setOfflineCache: () => setOfflineCache,
    setOfflineScope: () => setOfflineScope,
    setQueueStore: () => setQueueStore,
    setTokenStorage: () => setTokenStorage,
    startStream: () => startStream,
    stopStream: () => stopStream
  });

  // packages/core/src/rbac.ts
  var CORTEX_ROLES = [
    "super_admin",
    "platform_admin",
    "company_admin",
    "project_manager",
    "foreman",
    "operative",
    "client"
  ];
  var CAPABILITIES = [
    "workspace.read",
    "workspace.manage",
    "workspace.billing",
    "workspace.members",
    "project.read",
    "project.create",
    "project.manage",
    "task.read",
    "task.create",
    "task.assign",
    "task.approve",
    "time.read",
    "time.clock",
    "time.approve",
    "procurement.read",
    "procurement.create",
    "procurement.approve",
    "finance.read",
    "finance.create",
    "finance.approve",
    "documents.read",
    "documents.create",
    "documents.approve",
    "drawings.read",
    "drawings.annotate",
    "drawings.approve",
    "safety.read",
    "safety.create",
    "safety.approve",
    "quality.read",
    "quality.create",
    "quality.approve",
    "client.read",
    "client.communicate",
    "client.approve",
    "ai.use",
    "ai.execute",
    "ai.approve",
    "audit.read"
  ];
  var ALL = new Set(CAPABILITIES);
  var ROLE_CAPABILITIES = {
    super_admin: ALL,
    platform_admin: new Set(CAPABILITIES.filter((c) => !c.startsWith("client."))),
    company_admin: new Set(CAPABILITIES),
    project_manager: /* @__PURE__ */ new Set([
      "workspace.read",
      "project.read",
      "project.manage",
      "task.read",
      "task.create",
      "task.assign",
      "task.approve",
      "time.read",
      "time.approve",
      "procurement.read",
      "procurement.create",
      "finance.read",
      "documents.read",
      "documents.create",
      "documents.approve",
      "drawings.read",
      "drawings.annotate",
      "safety.read",
      "safety.create",
      "safety.approve",
      "quality.read",
      "quality.create",
      "client.read",
      "client.communicate",
      "ai.use",
      "ai.execute",
      "ai.approve",
      "audit.read"
    ]),
    foreman: /* @__PURE__ */ new Set([
      "workspace.read",
      "project.read",
      "project.manage",
      "task.read",
      "task.create",
      "task.assign",
      "time.read",
      "time.clock",
      "documents.read",
      "documents.create",
      "drawings.read",
      "drawings.annotate",
      "safety.read",
      "safety.create",
      "quality.read",
      "quality.create",
      "ai.use"
    ]),
    operative: /* @__PURE__ */ new Set([
      "workspace.read",
      "project.read",
      "task.read",
      "task.create",
      "time.read",
      "time.clock",
      "documents.read",
      "documents.create",
      "drawings.read",
      "drawings.annotate",
      "safety.read",
      "safety.create",
      "quality.read",
      "quality.create",
      "ai.use"
    ]),
    client: /* @__PURE__ */ new Set([
      "project.read",
      "task.read",
      "documents.read",
      "drawings.read",
      "quality.read",
      "client.read",
      "client.communicate",
      "client.approve"
    ])
  };
  function hasCapability(role, capability) {
    const set = ROLE_CAPABILITIES[role];
    return !!set && ALL.has(capability) && set.has(capability);
  }
  function capabilitiesFor(role) {
    const set = ROLE_CAPABILITIES[role];
    return set ? CAPABILITIES.filter((c) => set.has(c)) : [];
  }
  function assertCapability(role, capability) {
    if (!hasCapability(role, capability)) throw new Error(`forbidden:${capability}`);
  }

  // packages/core/src/index.ts
  var API_URL_FALLBACK = "https://cortexbuildpro.tech";
  var _memToken = null;
  function defaultTokenStorage() {
    try {
      if (typeof localStorage !== "undefined") return {
        get: () => localStorage.getItem("cb_token"),
        set: (t) => localStorage.setItem("cb_token", t),
        clear: () => localStorage.removeItem("cb_token")
      };
    } catch {
    }
    return { get: () => _memToken, set: (t) => {
      _memToken = t;
    }, clear: () => {
      _memToken = null;
    } };
  }
  var _store = defaultTokenStorage();
  function setTokenStorage(store) {
    _store = store;
  }
  var _offlineScope = null;
  function setOfflineScope(scope) {
    _offlineScope = scope;
  }
  var _cache = null;
  function setOfflineCache(c) {
    _cache = c;
  }
  var _deniedCache = /* @__PURE__ */ new Set();
  var _denialEpoch = /* @__PURE__ */ new Map();
  function cacheKey(name, scope) {
    return "cb_cache_" + scope + "_" + name;
  }
  function denialVersion(name, scope) {
    return scope ? _denialEpoch.get(cacheKey(name, scope)) || 0 : 0;
  }
  async function denyCached(name, scope) {
    if (!scope) return;
    const key = cacheKey(name, scope);
    _deniedCache.add(key);
    _denialEpoch.set(key, (_denialEpoch.get(key) || 0) + 1);
    try {
      await (_cache == null ? void 0 : _cache.set(key, "null"));
    } catch {
    }
  }
  async function cacheGet(name, scope = _offlineScope) {
    if (!_cache || !scope || scope !== _offlineScope) return null;
    const key = cacheKey(name, scope);
    if (_deniedCache.has(key)) return null;
    try {
      const value = await _cache.get(key);
      if (scope !== _offlineScope || _deniedCache.has(key)) return null;
      if (!value) return null;
      const rows = JSON.parse(value);
      return Array.isArray(rows) ? rows : null;
    } catch {
      return null;
    }
  }
  async function cacheSet(name, rows, scope = _offlineScope) {
    if (!_cache || !scope || scope !== _offlineScope) return;
    try {
      await _cache.set(cacheKey(name, scope), JSON.stringify(rows));
    } catch {
    }
  }
  var _queue = [];
  var _queueStore = null;
  var _queueListeners = [];
  function setQueueStore(s, onLoad) {
    _queueStore = s;
    if (onLoad) {
      _queue = onLoad;
      notifyQueue();
    }
  }
  function notifyQueue() {
    _queueListeners.forEach((l) => l());
  }
  function onQueueChange(cb) {
    _queueListeners.push(cb);
    return () => {
      _queueListeners = _queueListeners.filter((l) => l !== cb);
    };
  }
  function pendingWrites() {
    return _queue.length;
  }
  function isScopedWrite(write) {
    return typeof write.scope === "string" && write.scope.trim().length > 0;
  }
  function legacyPendingWrites() {
    return _queue.filter((write) => !isScopedWrite(write)).length;
  }
  function exportLegacyWrites() {
    return JSON.stringify({ format: "cortex-legacy-offline-queue", version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), entries: _queue.filter((write) => !isScopedWrite(write)) }, null, 2);
  }
  async function discardLegacyWrites() {
    const before = _queue.length;
    _queue = _queue.filter(isScopedWrite);
    const discarded = before - _queue.length;
    if (discarded) {
      await queuePersist();
      notifyQueue();
    }
    return discarded;
  }
  async function queuePersist() {
    if (_queueStore) try {
      await _queueStore.set("cb_queue", JSON.stringify(_queue));
    } catch {
    }
  }
  async function enqueue(w) {
    _queue.push(w);
    await queuePersist();
    notifyQueue();
  }
  async function dequeue(id) {
    _queue = _queue.filter((w) => w.id !== id);
    await queuePersist();
    notifyQueue();
  }
  var _flushInFlight = null;
  function flushQueue(opts) {
    if (_flushInFlight) return _flushInFlight;
    const run = replayQueue(opts).finally(() => {
      if (_flushInFlight === run) _flushInFlight = null;
    });
    _flushInFlight = run;
    return run;
  }
  async function replayQueue(opts) {
    var _a;
    const snapshot = [..._queue];
    let ok = 0;
    let failed = 0;
    const API_URL = (opts == null ? void 0 : opts.apiUrl) || API_URL_FALLBACK;
    for (const w of snapshot) try {
      if (!_offlineScope || !w.scope || w.scope !== _offlineScope) {
        failed++;
        continue;
      }
      const headers = { "content-type": "application/json" };
      const t = (_a = opts == null ? void 0 : opts.token) != null ? _a : await _store.get();
      if (!_offlineScope || w.scope !== _offlineScope) {
        failed++;
        continue;
      }
      if (t) headers.authorization = `Bearer ${t}`;
      const r = await fetch(`${API_URL}/api/${w.collection}${w.rowId ? "/" + w.rowId : ""}`, { method: w.method, headers, body: JSON.stringify(w.body) });
      if (r.ok) {
        await dequeue(w.id);
        ok++;
      } else failed++;
    } catch {
      failed++;
    }
    return { ok, failed };
  }
  var _streamListeners = [];
  var _streamController = null;
  var _streamTimer = null;
  function onStreamEvent(cb) {
    _streamListeners.push(cb);
    return () => {
      _streamListeners = _streamListeners.filter((f) => f !== cb);
    };
  }
  function emitStream(e) {
    for (const f of _streamListeners) try {
      f(e);
    } catch {
    }
  }
  function startStream(opts) {
    stopStream();
    const base = opts.apiUrl.replace(/\/$/, "");
    const connect = async () => {
      const ctrl = new AbortController();
      _streamController = ctrl;
      try {
        const res = await fetch(`${base}/api/events/stream`, { headers: { Accept: "text/event-stream", Authorization: `Bearer ${opts.token}` }, signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error("stream " + res.status);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) throw new Error("stream closed");
          buf += dec.decode(value, { stream: true });
          const frames = buf.split("\n\n");
          buf = frames.pop() || "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              emitStream({ ...JSON.parse(line.slice(5).trim()), ts: Date.now() });
            } catch {
            }
          }
        }
      } catch {
        if (!ctrl.signal.aborted) _streamTimer = setTimeout(connect, 4e3);
      }
    };
    void connect();
  }
  function stopStream() {
    try {
      _streamController == null ? void 0 : _streamController.abort();
    } catch {
    }
    _streamController = null;
    if (_streamTimer) clearTimeout(_streamTimer);
    _streamTimer = null;
  }
  function httpFailure(message, status) {
    const error = new Error(message);
    error.httpStatus = status;
    return error;
  }
  function isHttpFailure(error) {
    return Number.isInteger(error == null ? void 0 : error.httpStatus);
  }
  function createApiClient(opts = {}) {
    const API_URL = opts.apiUrl || API_URL_FALLBACK;
    const store = opts.tokenStorage || _store;
    const token = async () => await store.get();
    async function apiGet(path) {
      const t = await token();
      const r = await fetch(`${API_URL}${path}`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
      if (r.status === 401) {
        await store.clear();
        throw new Error("unauthorized");
      }
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        throw httpFailure((detail == null ? void 0 : detail.error) || "Request failed", r.status);
      }
      return r.json();
    }
    async function readPagedCollection(path, key, maxRows) {
      var _a;
      const rows = [];
      const target = Math.min(Math.max(1, Math.floor(maxRows)), 1e3);
      let offset = 0;
      for (let page = 0; page < 10 && rows.length < target; page++) {
        const take = Math.min(100, target - rows.length);
        const separator = path.includes("?") ? "&" : "?";
        const data = await apiGet(`${path}${separator}take=${take}&skip=${offset}`);
        const slice = Array.isArray(data) ? data : (_a = data == null ? void 0 : data.rows) != null ? _a : data == null ? void 0 : data[key];
        if (!Array.isArray(slice)) {
          const error = httpFailure(`Unexpected ${key} response`, 502);
          error.invalidResponse = true;
          throw error;
        }
        rows.push(...slice);
        offset += slice.length;
        if (!(data == null ? void 0 : data.hasMore) || !slice.length) break;
      }
      return rows;
    }
    async function apiPost(path, body) {
      const t = await token();
      const r = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "content-type": "application/json", ...t ? { authorization: `Bearer ${t}` } : {} }, body: JSON.stringify(body) });
      if (r.status === 401) {
        await store.clear();
        throw new Error("unauthorized");
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw httpFailure(e.error || "Create failed", r.status);
      }
      return r.json();
    }
    return {
      API_URL,
      getToken: token,
      setToken: (t) => store.set(t),
      clearToken: () => store.clear(),
      async login(email, password) {
        const r = await fetch(`${API_URL}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "Login failed");
        }
        const d = await r.json();
        if (!d.token) throw new Error("No token returned");
        await store.set(d.token);
        return d;
      },
      async logout() {
        await store.clear();
      },
      async getMe() {
        try {
          const d = await apiGet("/api/auth/me");
          return d && (d.user || d);
        } catch {
          return null;
        }
      },
      async getProjects() {
        const scope = _offlineScope;
        const version = denialVersion("projects", scope);
        try {
          const rows = await readPagedCollection("/api/projects", "projects", 1e3);
          if (scope !== _offlineScope) throw new Error("Workspace changed during project loading");
          if (version !== denialVersion("projects", scope)) throw httpFailure("Project access changed during loading", 403);
          await cacheSet("projects", rows, scope);
          if (scope !== _offlineScope) throw new Error("Workspace changed during project loading");
          if (version !== denialVersion("projects", scope)) {
            await denyCached("projects", scope);
            throw httpFailure("Project access changed during loading", 403);
          }
          if (scope) _deniedCache.delete(cacheKey("projects", scope));
          return rows;
        } catch (error) {
          if ((error == null ? void 0 : error.message) === "unauthorized" || (error == null ? void 0 : error.httpStatus) === 403) await denyCached("projects", scope);
          if ((error == null ? void 0 : error.message) === "unauthorized" || isHttpFailure(error) && ((error.httpStatus || 0) < 500 || error.invalidResponse === true) || scope !== _offlineScope) throw error;
          const cached = await cacheGet("projects", scope);
          if (cached) return cached;
          throw error;
        }
      },
      async getCollection(name, limit = 100) {
        const scope = _offlineScope;
        const version = denialVersion(name, scope);
        const responseKey = {
          timeentries: "entries",
          checkins: "checkins",
          safety: "incidents",
          team: "team",
          documents: "documents",
          receipts: "receipts",
          "equipment-checks": "checks",
          "field-constraints": "constraints",
          "field-handovers": "handovers",
          "field-production": "logs"
        };
        try {
          const rows = await readPagedCollection(`/api/${encodeURIComponent(name)}`, responseKey[name] || name, limit);
          if (scope !== _offlineScope) throw new Error("Workspace changed during collection loading");
          if (version !== denialVersion(name, scope)) throw httpFailure("Collection access changed during loading", 403);
          await cacheSet(name, rows, scope);
          if (scope !== _offlineScope) throw new Error("Workspace changed during collection loading");
          if (version !== denialVersion(name, scope)) {
            await denyCached(name, scope);
            throw httpFailure("Collection access changed during loading", 403);
          }
          if (scope) _deniedCache.delete(cacheKey(name, scope));
          return rows;
        } catch (error) {
          if ((error == null ? void 0 : error.message) === "unauthorized" || (error == null ? void 0 : error.httpStatus) === 403) await denyCached(name, scope);
          if ((error == null ? void 0 : error.message) === "unauthorized" || isHttpFailure(error) && ((error.httpStatus || 0) < 500 || error.invalidResponse === true) || scope !== _offlineScope) throw error;
          const cached = await cacheGet(name, scope);
          if (cached) return cached.slice(0, Math.min(1e3, Math.max(1, Math.floor(limit))));
          throw error;
        }
      },
      postCollection(name, body) {
        const scope = _offlineScope;
        return apiPost(`/api/${name}`, body).catch(async (e) => {
          if ((e == null ? void 0 : e.message) === "unauthorized" || isHttpFailure(e)) throw e;
          if (!scope) throw new Error("Offline save is unavailable until your company workspace is verified. Reconnect and try again.");
          if (scope !== _offlineScope) throw new Error("Workspace changed while saving. Reconnect and retry in the active company.");
          const id = "cw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          await enqueue({ id, method: "POST", collection: name, body, scope });
          return { id, _queued: true, ...body };
        });
      },
      async putCollection(name, id, body) {
        const scope = _offlineScope;
        const t = await token();
        if (scope !== _offlineScope) throw new Error("Workspace changed while saving. Reconnect and retry in the active company.");
        const headers = { "content-type": "application/json" };
        if (t) headers.authorization = `Bearer ${t}`;
        try {
          const r = await fetch(`${API_URL}/api/${name}/${id}`, { method: "PUT", headers, body: JSON.stringify(body) });
          if (r.status === 401) {
            await store.clear();
            throw new Error("unauthorized");
          }
          if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            throw httpFailure(e.error || "Update failed", r.status);
          }
          return r.json();
        } catch (e) {
          if ((e == null ? void 0 : e.message) === "unauthorized" || isHttpFailure(e)) throw e;
          if (!scope) throw new Error("Offline save is unavailable until your company workspace is verified. Reconnect and try again.");
          if (scope !== _offlineScope) throw new Error("Workspace changed while saving. Reconnect and retry in the active company.");
          const qid = "cw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          await enqueue({ id: qid, method: "PUT", collection: name, rowId: id, body, scope });
          return { id, _queued: true, ...body };
        }
      },
      apiGet,
      apiPost,
      onQueueChange,
      pendingWrites,
      legacyPendingWrites,
      exportLegacyWrites,
      discardLegacyWrites,
      flushQueue,
      startStream,
      stopStream,
      onStreamEvent
    };
  }
  var api = createApiClient();
  if (typeof window !== "undefined") window.CortexCore = { createApiClient, api, API_URL: API_URL_FALLBACK };
  return __toCommonJS(index_exports);
})();
