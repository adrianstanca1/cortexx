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
    api: () => api,
    createApiClient: () => createApiClient
  });
  var API_URL_FALLBACK = "https://cortexbuildpro.com";
  function createApiClient(opts = {}) {
    const API_URL = opts.apiUrl || API_URL_FALLBACK;
    const store = opts.tokenStorage || (typeof localStorage !== "undefined" ? {
      get: () => localStorage.getItem("cb_token"),
      set: (t) => localStorage.setItem("cb_token", t),
      clear: () => localStorage.removeItem("cb_token")
    } : { get: () => null, set: () => {
    }, clear: () => {
    } });
    async function token() {
      return await store.get();
    }
    async function apiGet(path) {
      const t = await token();
      const r = await fetch(`${API_URL}${path}`, {
        headers: t ? { authorization: `Bearer ${t}` } : {}
      });
      if (r.status === 401) {
        await store.clear();
        throw new Error("unauthorized");
      }
      if (!r.ok) throw new Error("Request failed");
      return r.json();
    }
    async function apiPost(path, body) {
      const t = await token();
      const r = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...t ? { authorization: `Bearer ${t}` } : {}
        },
        body: JSON.stringify(body)
      });
      if (r.status === 401) {
        await store.clear();
        throw new Error("unauthorized");
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Create failed");
      }
      return r.json();
    }
    return {
      API_URL,
      getToken: token,
      setToken: (t) => store.set(t),
      clearToken: () => store.clear(),
      async login(email, password) {
        const r = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error === "invalid credentials" ? "Invalid email or password." : e.error || "Login failed");
        }
        const d = await r.json();
        if (!d.token) throw new Error("No token returned");
        await store.set(d.token);
        return d;
      },
      async logout() {
        await store.clear();
      },
      async getProjects() {
        const d = await apiGet("/api/projects?limit=100");
        return Array.isArray(d) ? d : d.rows || [];
      },
      async getCollection(name, limit = 100) {
        const d = await apiGet(`/api/${name}?limit=${limit}`);
        return Array.isArray(d) ? d : [];
      },
      postCollection(name, body) {
        return apiPost(`/api/${name}`, body);
      },
      async lookupTickets(email) {
        const r = await apiPost("/api/support/tickets/lookup", { email });
        return Array.isArray(r) ? r : r.tickets || [];
      },
      apiGet,
      apiPost
    };
  }
  var api = createApiClient();
  if (typeof window !== "undefined") {
    window.CortexCore = { createApiClient, api, API_URL: API_URL_FALLBACK };
  }
  return __toCommonJS(index_exports);
})();
