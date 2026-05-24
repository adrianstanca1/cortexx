import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...mod,
    S3Client: vi.fn(),
  };
});

describe("/api/health minio check", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
  });

  it("minio:true when bucket headBucket succeeds", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    (S3Client as any).mockImplementation(() => ({
      send: vi.fn(async () => ({})),
    }));

    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    process.env.S3_BUCKET = "cortexbuild-field";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";

    const { checkMinioReady, resetS3Client } = await import("../server/storage");
    resetS3Client();
    const result = await checkMinioReady();
    expect(result.ok).toBe(true);
  });

  it("minio:false when bucket headBucket throws", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    (S3Client as any).mockImplementation(() => ({
      send: vi.fn(async () => {
        const err = new Error("NoSuchBucket") as any;
        err.name = "NoSuchBucket";
        throw err;
      }),
    }));

    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    process.env.S3_BUCKET = "cortexbuild-field";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";

    const { checkMinioReady, resetS3Client } = await import("../server/storage");
    resetS3Client();
    const result = await checkMinioReady();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/nosuchbucket/);
    }
  });
});
