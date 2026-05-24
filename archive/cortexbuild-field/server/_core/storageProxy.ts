import fs from "fs";
import path from "path";
import type { Express, Request, Response } from "express";
import { LOCAL_STORAGE_ROOT, storageGetSignedUrl } from "../storage";
import { log } from "./logger";

async function handleStorageRequest(req: Request, res: Response) {
  const key = (req.params as Record<string, string>)[0];
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }

  try {
    const signedUrl = await storageGetSignedUrl(key);

    // Local-fallback path (no S3 client) — storageGetSignedUrl returns
    // a relative `/storage/<key>` URL; serve the file from disk.
    if (signedUrl.startsWith("/storage/") || signedUrl.startsWith("/manus-storage/")) {
      const storageRoot = path.resolve(LOCAL_STORAGE_ROOT);
      const filePath = path.resolve(storageRoot, key);
      if (!filePath.startsWith(storageRoot + path.sep)) {
        res.status(400).send("Invalid storage key");
        return;
      }
      if (!fs.existsSync(filePath)) {
        res.status(404).send("Stored file not found");
        return;
      }
      res.set("Cache-Control", "private, max-age=3600");
      res.sendFile(filePath);
      return;
    }

    res.set("Cache-Control", "no-store");
    res.redirect(302, signedUrl);
  } catch (err) {
    log.error("[StorageProxy] failed:", err);
    res.status(502).send("Storage backend error");
  }
}

export function registerStorageProxy(app: Express) {
  // Canonical path for new writes.
  app.get("/storage/*", handleStorageRequest);
  // Deprecated alias — DB rows persisted before P1.C still hold
  // `/manus-storage/<key>` URLs. Remove after a data-backfill rename.
  app.get("/manus-storage/*", handleStorageRequest);
}
