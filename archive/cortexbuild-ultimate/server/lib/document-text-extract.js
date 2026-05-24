/**
 * Best-effort plain-text extraction for construction document AI.
 * PDF via pdf-parse; UTF-8 for .txt / .csv. Other types return empty string.
 */
const fs = require("fs");
const path = require("path");

const MAX_CHARS = 14_000;

/**
 * @param {string} absolutePath - validated path inside uploads
 * @param {string} typeUpper - e.g. PDF, TXT
 * @returns {Promise<string>}
 */
async function extractReadableTextFromDocument(absolutePath, typeUpper) {
  const ext = path.extname(absolutePath).replace(".", "").toLowerCase() || String(typeUpper || "").toLowerCase();

  if (["txt", "csv", "md", "json"].includes(ext)) {
    try {
      const raw = fs.readFileSync(absolutePath, "utf8");
      return raw.replace(/\0/g, "").slice(0, MAX_CHARS);
    } catch {
      return "";
    }
  }

  if (ext === "pdf") {
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      const pdfParse = require("pdf-parse");
      const buf = fs.readFileSync(absolutePath);
      const data = await pdfParse(buf);
      const text = (data.text || "").replace(/\s+/g, " ").trim();
      return text.slice(0, MAX_CHARS);
    } catch (e) {
      console.warn("[document-text-extract] PDF extract failed:", e.message);
      return "";
    }
  }

  return "";
}

module.exports = { extractReadableTextFromDocument, MAX_CHARS };
