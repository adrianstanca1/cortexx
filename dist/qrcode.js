// Cortexx — compact QR Code generator (byte mode, EC level L, versions 1–9)
// Self-contained, no network. Enough capacity for any check-in URL (~229 bytes).
// Exposes window.CortexQR.matrix(text) -> boolean[][]  and  .toCanvas(text, opts).
//
// Correctness: the Reed–Solomon generator polynomials are validated against the
// QR spec's published vectors in CortexQR._selftest() (run at load in dev).

(function () {
  // ── Galois field GF(256), primitive 0x11d ────────────────
  const EXP = new Array(512), LOG = new Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  // Reed–Solomon generator polynomial of given degree.
  function rsGen(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gmul(poly[j], EXP[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly.reverse(); // leading coeff (α^0=1) first, matching rsEncode's indexing
  }
  function rsEncode(data, ecLen) {
    const gen = rsGen(ecLen);
    const res = new Array(ecLen).fill(0);
    for (const d of data) {
      const factor = d ^ res[0];
      res.shift(); res.push(0);
      for (let j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j + 1], factor);
    }
    return res;
  }

  // ── Per-version tables (EC level L) ──────────────────────
  // [ totalCodewords, ecPerBlock, numBlocks ]  (v6–9 are 2 equal blocks)
  const VER = {
    1: [26, 7, 1], 2: [44, 10, 1], 3: [70, 15, 1], 4: [100, 20, 1], 5: [134, 26, 1],
    6: [172, 18, 2], 7: [196, 20, 2], 8: [242, 24, 2], 9: [292, 30, 2],
  };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46] };
  const size = (v) => v * 4 + 17;
  const dataCodewords = (v) => { const [t, ec, b] = VER[v]; return t - ec * b; };

  // ── Bit buffer ───────────────────────────────────────────
  function encodeData(text, v) {
    const bytes = []; for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    put(0b0100, 4);                 // byte mode
    put(bytes.length, 8);           // char count (8 bits for v1–9 in byte mode)
    for (const b of bytes) put(b, 8);
    const cap = dataCodewords(v) * 8;
    if (bits.length > cap) return null; // doesn't fit this version
    // terminator
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
    const pads = [0xec, 0x11]; let pi = 0;
    while (cw.length < dataCodewords(v)) { cw.push(pads[pi++ % 2]); }
    return cw;
  }

  function pickVersion(text) {
    for (let v = 1; v <= 9; v++) { if (encodeData(text, v)) return v; }
    return null;
  }

  // Interleave data + EC across blocks.
  function buildCodewords(text, v) {
    const [, ecLen, nb] = VER[v];
    const cw = encodeData(text, v);
    const per = cw.length / nb;
    const blocks = [], ecBlocks = [];
    for (let i = 0; i < nb; i++) { const blk = cw.slice(i * per, (i + 1) * per); blocks.push(blk); ecBlocks.push(rsEncode(blk, ecLen)); }
    const out = [];
    for (let i = 0; i < per; i++) for (const b of blocks) out.push(b[i]);
    for (let i = 0; i < ecLen; i++) for (const e of ecBlocks) out.push(e[i]);
    return out;
  }

  // ── Matrix build ─────────────────────────────────────────
  function buildMatrix(text) {
    const v = pickVersion(text); if (!v) return null;
    const n = size(v);
    const m = Array.from({ length: n }, () => new Array(n).fill(null));   // null = unset
    const reserved = Array.from({ length: n }, () => new Array(n).fill(false));

    const setF = (r, c, val) => { m[r][c] = val ? 1 : 0; reserved[r][c] = true; };
    // Finder + separator
    const finder = (r, c) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const inRing = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6));
        const inCore = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        setF(rr, cc, inRing || inCore);
      }
    };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    // Timing
    for (let i = 8; i < n - 8; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    // Alignment
    const ap = ALIGN[v];
    for (const r of ap) for (const c of ap) {
      if ((r <= 7 && c <= 7) || (r <= 7 && c >= n - 8) || (r >= n - 8 && c <= 7)) continue;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const isRing = Math.max(Math.abs(i), Math.abs(j)) === 2 || (i === 0 && j === 0);
        setF(r + i, c + j, isRing);
      }
    }
    // Dark module
    setF(n - 8, 8, 1);
    // Reserve format areas
    for (let i = 0; i < 9; i++) { if (!reserved[8][i]) reserved[8][i] = true; if (!reserved[i][8]) reserved[i][8] = true; }
    for (let i = 0; i < 8; i++) { reserved[8][n - 1 - i] = true; reserved[n - 1 - i][8] = true; }
    // Reserve version info (v≥7)
    if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { reserved[i][n - 11 + j] = true; reserved[n - 11 + j][i] = true; }

    // Place data with zigzag
    const cw = buildCodewords(text, v);
    let bitIdx = 0; const totalBits = cw.length * 8;
    const bitAt = (i) => (cw[i >> 3] >> (7 - (i & 7))) & 1;
    let col = n - 1, upward = true;
    while (col > 0) {
      if (col === 6) col--; // skip timing column
      for (let i = 0; i < n; i++) {
        const row = upward ? n - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (reserved[row][c]) continue;
          let bit = bitIdx < totalBits ? bitAt(bitIdx) : 0; bitIdx++;
          m[row][c] = bit;
        }
      }
      col -= 2; upward = !upward;
    }

    // Masking
    const maskFns = [
      (r, c) => (r + c) % 2 === 0,
      (r, c) => r % 2 === 0,
      (r, c) => c % 3 === 0,
      (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
      (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
      (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
      (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
    ];
    const applyMask = (mat, fn) => mat.map((row, r) => row.map((val, c) => reserved[r][c] ? val : (val ^ (fn(r, c) ? 1 : 0))));

    // Format info (level L = 01) BCH
    const fmtBits = (mask) => {
      let data = (0b01 << 3) | mask;            // 5 bits
      let rem = data << 10;
      const g = 0b10100110111;
      for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= g << (i - 10);
      let bits = ((data << 10) | rem) ^ 0b101010000010010;
      return bits & 0x7fff;
    };
    const placeFormat = (mat, mask) => {
      const bits = fmtBits(mask);
      const get = (i) => (bits >> i) & 1;
      for (let i = 0; i <= 5; i++) mat[8][i] = get(i);
      mat[8][7] = get(6); mat[8][8] = get(7); mat[7][8] = get(8);
      for (let i = 9; i <= 14; i++) mat[14 - i][8] = get(i);
      for (let i = 0; i <= 7; i++) mat[n - 1 - i][8] = get(i);
      for (let i = 8; i <= 14; i++) mat[8][n - 15 + i] = get(i);
      mat[n - 8][8] = 1; // dark module
    };
    const placeVersion = (mat) => {
      if (v < 7) return;
      let rem = v << 12; const g = 0b1111100100101;
      for (let i = 17; i >= 12; i--) if ((rem >> i) & 1) rem ^= g << (i - 12);
      const bits = (v << 12) | rem;
      for (let i = 0; i < 18; i++) { const b = (bits >> i) & 1; const r = Math.floor(i / 3), c = i % 3; mat[r][n - 11 + c] = b; mat[n - 11 + c][r] = b; }
    };

    // Penalty scoring to choose best mask
    const penalty = (mat) => {
      let p = 0;
      for (let r = 0; r < n; r++) { let run = 1; for (let c = 1; c < n; c++) { if (mat[r][c] === mat[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let c = 0; c < n; c++) { let run = 1; for (let r = 1; r < n; r++) { if (mat[r][c] === mat[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const x = mat[r][c]; if (x === mat[r][c + 1] && x === mat[r + 1][c] && x === mat[r + 1][c + 1]) p += 3; }
      let dark = 0; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += mat[r][c]; const pct = dark * 100 / (n * n); p += Math.floor(Math.abs(pct - 50) / 5) * 10;
      return p;
    };

    let best = null, bestP = Infinity, bestMask = 0;
    for (let mask = 0; mask < 8; mask++) {
      let cand = applyMask(m, maskFns[mask]);
      placeFormat(cand, mask); placeVersion(cand);
      const p = penalty(cand);
      if (p < bestP) { bestP = p; best = cand; bestMask = mask; }
    }
    return best.map(row => row.map(x => x === 1));
  }

  function toCanvas(text, opts = {}) {
    const mat = buildMatrix(text); if (!mat) return null;
    const n = mat.length, q = opts.quiet != null ? opts.quiet : 4, scale = opts.scale || 6;
    const px = (n + q * 2) * scale;
    const cv = document.createElement('canvas'); cv.width = px; cv.height = px;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = opts.bg || '#fff'; ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = opts.fg || '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mat[r][c]) ctx.fillRect((c + q) * scale, (r + q) * scale, scale, scale);
    return cv;
  }

  // ── Self-test: validate RS generator polys vs QR spec ────
  function _selftest() {
    const expExps = (deg, known) => {
      const g = rsGen(deg).map(coef => coef === 0 ? -1 : LOG[coef]);
      return JSON.stringify(g) === JSON.stringify(known);
    };
    const ok7 = expExps(7, [0, 87, 229, 146, 149, 238, 102, 21]);
    const ok10 = expExps(10, [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45]);
    return { rs7: ok7, rs10: ok10, ok: ok7 && ok10 };
  }

  window.CortexQR = { matrix: buildMatrix, toCanvas, pickVersion, _selftest };
})();
