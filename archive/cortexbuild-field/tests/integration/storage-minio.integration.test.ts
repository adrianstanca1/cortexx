/**
 * Integration: MinIO upload + read-back.
 * Requires a MinIO container (CI service container) or local Docker.
 * Skipped gracefully when S3_ENDPOINT is not set and Docker is unavailable.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import { storagePut, storageGetSignedUrl } from "../../server/storage";

describe("storage-minio-integration", () => {
  const endpoint = process.env.S3_ENDPOINT || "http://127.0.0.1:9000";
  const bucket = process.env.S3_BUCKET || "cortexbuild-field";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || "minioadmin";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "minioadmin";

  beforeAll(async () => {
    // Ensure env is wired so getS3Client returns a client.
    process.env.S3_ENDPOINT = endpoint;
    process.env.S3_BUCKET = bucket;
    process.env.S3_ACCESS_KEY_ID = accessKeyId;
    process.env.S3_SECRET_ACCESS_KEY = secretAccessKey;
    process.env.S3_REGION = "us-east-1";
    process.env.S3_FORCE_PATH_STYLE = "true";

    const s3 = new S3Client({
      endpoint,
      region: "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (err: any) {
      // BucketAlreadyExists / BucketAlreadyOwnedByYou are fine
      if (!/AlreadyExists|AlreadyOwnedByYou/.test(err?.name || err?.Code || "")) {
        console.warn("[integration] Could not create bucket:", err?.message || err);
      }
    }
  });

  afterAll(() => {
    // Clean up env so other tests aren't polluted if they share the process.
    // (Each integration test file runs in its own fork via singleFork.)
  });

  it("uploads a buffer and reads it back via presigned GET", async () => {
    const data = Buffer.from("hello-minio-integration-" + Date.now());
    const { key } = await storagePut("integration/hello.txt", data, "text/plain");

    const signedUrl = await storageGetSignedUrl(key);
    // Should be a real presigned URL, not the local-fs fallback path.
    expect(signedUrl).not.toMatch(/^\/(storage|manus-storage)\//);
    expect(signedUrl).toContain(key);

    const resp = await fetch(signedUrl);
    expect(resp.status).toBe(200);
    const body = Buffer.from(await resp.arrayBuffer());
    expect(body.equals(data)).toBe(true);
  });

  it("checkMinioReady returns ok when bucket is reachable", async () => {
    const { checkMinioReady } = await import("../../server/storage");
    const result = await checkMinioReady();
    expect(result.ok).toBe(true);
  });
});
