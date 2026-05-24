import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...mod,
    S3Client: vi.fn(),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@aws-sdk/s3-request-presigner")>();
  return {
    ...mod,
    getSignedUrl: vi.fn(),
  };
});

const TMP_ROOT = await mkdtemp(path.join(tmpdir(), "storage-proxy-test-"));
process.env.LOCAL_STORAGE_DIR = TMP_ROOT;

let server: ReturnType<express.Express["listen"]> | null = null;
let baseUrl = "";

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
    baseUrl = "";
  }
  vi.restoreAllMocks();
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
  delete process.env.S3_BUCKET;
});

afterAll(async () => {
  await rm(TMP_ROOT, { recursive: true, force: true }).catch(() => {});
});

async function bootProxy() {
  vi.resetModules();
  const { registerStorageProxy } = await import("../server/_core/storageProxy");
  const app = express();
  registerStorageProxy(app);
  server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
}

describe("storageProxy — local fallback (S3 unconfigured)", () => {
  beforeEach(async () => {
    delete process.env.S3_ENDPOINT;
    process.env.LOCAL_STORAGE_DIR = TMP_ROOT;
    await bootProxy();
  });

  it("streams local file when S3 client absent", async () => {
    const filePath = path.join(TMP_ROOT, "photo", "ok.txt");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "hello world");

    const resp = await fetch(`${baseUrl}/storage/photo/ok.txt`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(await resp.text()).toBe("hello world");
  });

  it("returns 404 for a missing file", async () => {
    const resp = await fetch(`${baseUrl}/storage/does/not/exist.txt`);
    expect(resp.status).toBe(404);
    expect(await resp.text()).toBe("Stored file not found");
  });

  it("returns 400 for a key that path-traverses out of the storage root", async () => {
    const resp = await fetch(`${baseUrl}/storage/..%2F..%2Fetc%2Fpasswd`);
    expect(resp.status).toBe(400);
    expect(await resp.text()).toBe("Invalid storage key");
  });
});

describe("storageProxy — S3 configured", () => {
  beforeEach(async () => {
    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    process.env.S3_ACCESS_KEY_ID = "testkey";
    process.env.S3_SECRET_ACCESS_KEY = "testsecret";
    process.env.S3_BUCKET = "cortexbuild-field";
  });

  it("302-redirects to presigned GET when S3 client present", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    (S3Client as any).mockImplementation(() => ({
      send: vi.fn(async () => ({})),
    }));

    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    (getSignedUrl as any).mockImplementation(
      async () => "http://127.0.0.1:9000/cortexbuild-field/photo/site.jpg?X-Amz-Signature=abc",
    );

    await bootProxy();
    const resp = await fetch(`${baseUrl}/storage/photo/site.jpg`, { redirect: "manual" });
    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "http://127.0.0.1:9000/cortexbuild-field/photo/site.jpg?X-Amz-Signature=abc",
    );
    expect(resp.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 502 when presign throws", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    (S3Client as any).mockImplementation(() => ({
      send: vi.fn(async () => ({})),
    }));

    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    (getSignedUrl as any).mockImplementation(async () => {
      throw new Error("NoSuchKey");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await bootProxy();
    const resp = await fetch(`${baseUrl}/storage/photo/site.jpg`, { redirect: "manual" });
    expect(resp.status).toBe(502);
    expect(await resp.text()).toBe("Storage backend error");
  });
});
