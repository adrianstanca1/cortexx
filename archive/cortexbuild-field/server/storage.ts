// Storage backend — MinIO (S3-compatible) with local-fs fallback.
// When S3_ENDPOINT is set, uploads go to MinIO via the AWS SDK.
// When unset, writes land on local disk (dev / sandbox).

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";
import { log } from "./_core/logger";

export const LOCAL_STORAGE_ROOT = path.resolve(
  process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "storage"),
);

let _s3Client: S3Client | null = null;
let _s3Checked = false;

export function getS3Client(): S3Client | null {
  if (_s3Checked) return _s3Client;
  _s3Checked = true;

  const endpoint = ENV.s3Endpoint;
  if (!endpoint) {
    if (ENV.isProduction) {
      log.warn(
        "[storage] S3_ENDPOINT is unset in production — falling back to local filesystem. " +
          "This is a configuration error; configure MinIO and set S3_ENDPOINT.",
      );
    } else {
      log.info("[storage] S3_ENDPOINT unset — using local filesystem fallback");
    }
    return null;
  }

  _s3Client = new S3Client({
    endpoint,
    region: ENV.s3Region,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
    forcePathStyle: ENV.s3ForcePathStyle,
    requestHandler: { requestTimeout: 5_000 },
  });

  log.info(`[storage] connected to MinIO at ${endpoint}`);
  return _s3Client;
}

export function normalizeStorageKey(relKey: string): string {
  return relKey.replace(/^\/+/g, "").replace(/\.\.(\/|\\)/g, "");
}

export function localStoragePath(relKey: string): string {
  const key = normalizeStorageKey(relKey);
  const resolved = path.resolve(LOCAL_STORAGE_ROOT, key);
  if (!resolved.startsWith(LOCAL_STORAGE_ROOT + path.sep) && resolved !== LOCAL_STORAGE_ROOT) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeStorageKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  const s3 = getS3Client();
  if (!s3) {
    const destination = localStoragePath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body);
    return { key, url: `/storage/${key}` };
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key, url: `/storage/${key}` };
  } catch (err: any) {
    const code = err?.name || err?.Code || "Unknown";
    const message = err?.message || String(err);
    log.error(`[storage] S3 PutObject failed (${code}): ${message}`);
    throw new Error(`S3 unavailable: ${code}`);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeStorageKey(relKey);
  return { key, url: `/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeStorageKey(relKey);
  const s3 = getS3Client();
  if (!s3) return `/storage/${key}`;

  try {
    const command = new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key });
    return await getSignedUrl(s3, command, { expiresIn: 300 });
  } catch (err: any) {
    const code = err?.name || err?.Code || "Unknown";
    const message = err?.message || String(err);
    log.error(`[storage] S3 presign failed (${code}): ${message}`);
    throw new Error(`S3 presign unavailable: ${code}`);
  }
}

export async function storageGetPresignedPutUrl(
  relKey: string,
  contentType: string,
  options?: { maxBytes?: number; expiresInSeconds?: number },
): Promise<{ key: string; presignedUrl: string; publicUrl: string }> {
  const key = appendHashSuffix(normalizeStorageKey(relKey));
  const s3 = getS3Client();

  // Local fallback — no presigned URL possible; return a marker so the
  // caller can fall back to base64 upload via the existing upload mutation.
  if (!s3) {
    return { key, presignedUrl: "", publicUrl: `/storage/${key}` };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: options?.expiresInSeconds ?? 300,
    });

    return { key, presignedUrl, publicUrl: `/storage/${key}` };
  } catch (err: any) {
    const code = err?.name || err?.Code || "Unknown";
    const message = err?.message || String(err);
    log.error(`[storage] S3 presigned PUT failed (${code}): ${message}`);
    throw new Error(`S3 presign unavailable: ${code}`);
  }
}

export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeStorageKey(relKey);
  const s3 = getS3Client();
  if (!s3) {
    // Local fallback — delete from disk if present.
    const fs = await import("node:fs/promises");
    const filePath = localStoragePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
    }
    return;
  }

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: ENV.s3Bucket, Key: key }));
  } catch (err: any) {
    const code = err?.name || err?.Code || "Unknown";
    const message = err?.message || String(err);
    log.error(`[storage] S3 DeleteObject failed (${code}): ${message}`);
    throw new Error(`S3 delete unavailable: ${code}`);
  }
}

export function resetS3Client(): void {
  _s3Client = null;
  _s3Checked = false;
}

export async function checkMinioReady(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s3 = getS3Client();
  if (!s3) {
    return { ok: false, reason: "s3_unconfigured" };
  }

  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 500);
    await s3.send(new HeadBucketCommand({ Bucket: ENV.s3Bucket }), { abortSignal: abort.signal });
    clearTimeout(timer);
    return { ok: true };
  } catch (err: any) {
    const reason = err?.name || err?.Code || "minio_check_failed";
    return { ok: false, reason: String(reason).toLowerCase() };
  }
}
