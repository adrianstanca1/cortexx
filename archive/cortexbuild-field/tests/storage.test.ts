import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...mod,
    S3Client: vi.fn(),
  };
});

const TMP_ROOT = await mkdtemp(path.join(tmpdir(), "cortex-storage-test-"));
process.env.LOCAL_STORAGE_DIR = TMP_ROOT;

async function loadStorage() {
  return import("../server/storage");
}

afterEach(async () => {
  await rm(TMP_ROOT, { recursive: true, force: true }).catch(() => {});
  vi.restoreAllMocks();
});

describe("normalizeStorageKey", () => {
  it("strips leading slashes and traversal segments", async () => {
    const { normalizeStorageKey } = await loadStorage();
    expect(normalizeStorageKey("/foo/bar.png")).toBe("foo/bar.png");
    expect(normalizeStorageKey("../../etc/passwd")).toBe("etc/passwd");
  });
});

describe("localStoragePath", () => {
  it("resolves benign keys under LOCAL_STORAGE_ROOT", async () => {
    const { localStoragePath, LOCAL_STORAGE_ROOT } = await loadStorage();
    const result = localStoragePath("photo/site.jpg");
    expect(result.startsWith(LOCAL_STORAGE_ROOT + path.sep)).toBe(true);
  });

  it("rejects keys that resolve outside the storage root after normalization", async () => {
    const { localStoragePath } = await loadStorage();
    // After normalization this becomes benign, but path.resolve with a null byte
    // could have quirks; either throw or stay inside root are both acceptable.
    const sneaky = "..\0/etc/passwd";
    let result: string | null = null;
    try {
      result = localStoragePath(sneaky);
    } catch (e) {
      expect((e as Error).message).toMatch(/Invalid storage key/);
      return;
    }
    expect(result!.startsWith(path.resolve(TMP_ROOT) + path.sep)).toBe(true);
  });
});

describe("storagePut — local fallback (S3_ENDPOINT unset)", () => {
  beforeEach(() => {
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    vi.resetModules();
  });

  it("writes the file under LOCAL_STORAGE_ROOT and returns a /storage/ URL", async () => {
    const { storagePut } = await loadStorage();
    const { key, url } = await storagePut("photo/test.txt", "hello world", "text/plain");
    expect(url).toBe(`/storage/${key}`);
    const written = await readFile(path.join(TMP_ROOT, key), "utf8");
    expect(written).toBe("hello world");
  });

  it("appends a hash suffix BEFORE the extension", async () => {
    const { storagePut } = await loadStorage();
    const { key } = await storagePut("doc/report.pdf", Buffer.from("pdf"), "application/pdf");
    expect(key).toMatch(/^doc\/report_[0-9a-f]{8}\.pdf$/);
  });

  it("avoids collisions", async () => {
    const { storagePut } = await loadStorage();
    const a = await storagePut("collision/file.txt", "A", "text/plain");
    const b = await storagePut("collision/file.txt", "B", "text/plain");
    expect(a.key).not.toBe(b.key);
  });

  it("accepts string, Buffer, and Uint8Array bodies", async () => {
    const { storagePut } = await loadStorage();
    const a = await storagePut("body/string.txt", "hi", "text/plain");
    const b = await storagePut("body/buffer.txt", Buffer.from([0x68, 0x69]), "text/plain");
    const c = await storagePut("body/uint8.txt", new Uint8Array([0x68, 0x69]), "text/plain");
    expect(await readFile(path.join(TMP_ROOT, a.key), "utf8")).toBe("hi");
    expect(await readFile(path.join(TMP_ROOT, b.key), "utf8")).toBe("hi");
    expect(await readFile(path.join(TMP_ROOT, c.key), "utf8")).toBe("hi");
  });
});

describe("storagePut — S3 path", () => {
  beforeEach(() => {
    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    process.env.S3_ACCESS_KEY_ID = "testkey";
    process.env.S3_SECRET_ACCESS_KEY = "testsecret";
    process.env.S3_BUCKET = "cortexbuild-field";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
  });

  it("uses S3Client when S3_ENDPOINT is set", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const s3SendCalls: any[] = [];
    (S3Client as any).mockImplementation(() => ({
      send: vi.fn(async (cmd: any) => {
        s3SendCalls.push(cmd);
        return {};
      }),
    }));

    const { storagePut } = await loadStorage();
    const { key, url } = await storagePut("photo/test.txt", "hello s3", "text/plain");
    expect(url).toBe(`/storage/${key}`);
    expect(s3SendCalls).toHaveLength(1);
    expect(s3SendCalls[0].input.Bucket).toBe("cortexbuild-field");
    expect(s3SendCalls[0].input.Key).toBe(key);
    expect(s3SendCalls[0].input.ContentType).toBe("text/plain");
  });

  it("appends hash suffix even on S3 path", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    (S3Client as any).mockImplementation(() => ({
      send: vi.fn(async () => ({})),
    }));

    const { storagePut } = await loadStorage();
    const { key } = await storagePut("doc/report.pdf", Buffer.from("pdf"), "application/pdf");
    expect(key).toMatch(/^doc\/report_[0-9a-f]{8}\.pdf$/);
  });

  it("rethrows S3 errors with stable error shape", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    (S3Client as any).mockImplementation(() => ({
      send: vi.fn(async () => {
        const err = new Error("Access Denied") as any;
        err.name = "AccessDenied";
        throw err;
      }),
    }));

    const { storagePut } = await loadStorage();
    await expect(storagePut("photo/nope.txt", "x", "text/plain")).rejects.toThrow(
      /S3 unavailable: AccessDenied/,
    );
  });
});

describe("storageGetSignedUrl", () => {
  beforeEach(() => {
    delete process.env.S3_ENDPOINT;
    vi.resetModules();
  });

  it("falls back to /storage/<key> when S3_ENDPOINT is unset", async () => {
    const { storageGetSignedUrl } = await loadStorage();
    const url = await storageGetSignedUrl("/photo/site.jpg");
    expect(url).toBe("/storage/photo/site.jpg");
  });
});
