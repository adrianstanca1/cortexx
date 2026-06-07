// CortexBuild Pro — End-to-end encryption (Phase 104, v1.2)
// Passphrase-derived AES-GCM encryption for the sync push/pull path.
// When E2EE is enabled, the cloud-sync layer encrypts each record's payload
// before it leaves the device. The server only sees ciphertext.
//
// Key derivation: PBKDF2(SHA-256, 250k iterations, random per-workspace salt)
// Cipher: AES-GCM 256, random 12-byte IV per record
// Wire format: { v: 1, iv: <b64>, ct: <b64> }  (replacing the plaintext data)
//
// Passphrase NEVER leaves the device. Lose it = lose access to encrypted
// records (intentionally — that's what E2EE means).

(function () {
  if (window.CortexE2EE) return;
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    window.CortexE2EE = {
      available: false
    };
    return;
  }
  const subtle = crypto.subtle;
  const ITERS = 250000;
  const SALT_KEY = 'cortexx_e2ee_salt';
  const ENABLED_KEY = 'cortexx_e2ee_on';
  let cachedKey = null;
  function bufToB64(buf) {
    let s = '';
    const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function b64ToBuf(s) {
    const raw = atob(s);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function randomBytes(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }
  async function deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const baseKey = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({
      name: 'PBKDF2',
      salt,
      iterations: ITERS,
      hash: 'SHA-256'
    }, baseKey, {
      name: 'AES-GCM',
      length: 256
    }, false, ['encrypt', 'decrypt']);
  }
  function getOrCreateSalt() {
    let s;
    try {
      s = localStorage.getItem(SALT_KEY);
    } catch (e) {}
    if (s) return b64ToBuf(s);
    const fresh = randomBytes(16);
    try {
      localStorage.setItem(SALT_KEY, bufToB64(fresh));
    } catch (e) {}
    return fresh;
  }
  async function unlock(passphrase) {
    const salt = getOrCreateSalt();
    const key = await deriveKey(passphrase, salt);
    // Verification: encrypt a fixed canary on first unlock; on subsequent
    // unlocks, decrypt the stored canary. A wrong key fails the GCM auth tag.
    const CANARY_KEY = 'cortexx_e2ee_canary';
    let canary;
    try {
      canary = localStorage.getItem(CANARY_KEY);
    } catch (e) {}
    if (canary) {
      try {
        const env = JSON.parse(canary);
        const pt = await subtle.decrypt({
          name: 'AES-GCM',
          iv: b64ToBuf(env.iv)
        }, key, b64ToBuf(env.ct));
        if (new TextDecoder().decode(pt) !== 'cortexbuild-pro-e2ee-v1') {
          return false;
        }
      } catch (e) {
        return false;
      }
    } else {
      // First time — write the canary under this passphrase
      const iv = randomBytes(12);
      const ct = await subtle.encrypt({
        name: 'AES-GCM',
        iv
      }, key, new TextEncoder().encode('cortexbuild-pro-e2ee-v1'));
      try {
        localStorage.setItem(CANARY_KEY, JSON.stringify({
          iv: bufToB64(iv),
          ct: bufToB64(ct)
        }));
      } catch (e) {}
    }
    cachedKey = key;
    try {
      localStorage.setItem(ENABLED_KEY, '1');
    } catch (e) {}
    return true;
  }
  function lock() {
    cachedKey = null;
  }
  function isEnabled() {
    try {
      return localStorage.getItem(ENABLED_KEY) === '1';
    } catch (e) {
      return false;
    }
  }
  function isUnlocked() {
    return !!cachedKey;
  }
  async function encrypt(plain) {
    if (!cachedKey) throw new Error('E2EE locked — call unlock(passphrase) first');
    const iv = randomBytes(12);
    const enc = new TextEncoder();
    const ct = await subtle.encrypt({
      name: 'AES-GCM',
      iv
    }, cachedKey, enc.encode(typeof plain === 'string' ? plain : JSON.stringify(plain)));
    return {
      v: 1,
      iv: bufToB64(iv),
      ct: bufToB64(ct),
      e: 1
    };
  }
  async function decrypt(env) {
    if (!env || env.v !== 1) return env; // pass through plain
    if (!cachedKey) throw new Error('E2EE locked — cannot decrypt');
    const pt = await subtle.decrypt({
      name: 'AES-GCM',
      iv: b64ToBuf(env.iv)
    }, cachedKey, b64ToBuf(env.ct));
    const text = new TextDecoder().decode(pt);
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  // Bulk transform for sync — encrypt an array of records (keeping ids/timestamps plain)
  async function encryptRecords(records, sensitiveKeys) {
    if (!cachedKey) return records;
    const keys = sensitiveKeys || null; // if null, encrypt the whole record minus id/_rev
    const out = [];
    for (const r of records) {
      const id = r.id,
        rev = r._rev;
      let payload;
      if (keys) {
        payload = {};
        for (const k of keys) if (k in r) payload[k] = r[k];
      } else {
        payload = Object.assign({}, r);
        delete payload.id;
        delete payload._rev;
      }
      const env = await encrypt(payload);
      out.push({
        id,
        _rev: rev,
        _enc: env
      });
    }
    return out;
  }
  async function decryptRecords(records) {
    if (!cachedKey) return records;
    const out = [];
    for (const r of records) {
      if (r && r._enc) {
        try {
          const pt = await decrypt(r._enc);
          out.push(Object.assign({
            id: r.id,
            _rev: r._rev
          }, pt));
        } catch (e) {
          out.push(r);
        } // can't decrypt — surface as-is
      } else out.push(r);
    }
    return out;
  }

  // Forget everything (effectively rotates: NEW data will be re-encrypted under a new passphrase)
  function forget() {
    try {
      localStorage.removeItem(SALT_KEY);
      localStorage.removeItem(ENABLED_KEY);
      localStorage.removeItem('cortexx_e2ee_canary');
    } catch (e) {}
    cachedKey = null;
  }
  window.CortexE2EE = {
    available: true,
    isEnabled,
    isUnlocked,
    lock,
    unlock,
    encrypt,
    decrypt,
    encryptRecords,
    decryptRecords,
    forget,
    iterations: ITERS
  };
})();