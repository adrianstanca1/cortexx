import { describe, it, expect, beforeAll } from "vitest";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { storagePut, getS3Client, checkMinioReady } from "../server/storage";
import { ENV } from "../server/_core/env";

describe.skipIf(!process.env.S3_ENDPOINT)("MinIO integration", () => {
  beforeAll(async () => {
    const ready = await checkMinioReady();
    if (!ready.ok) {
      throw new Error(`MinIO not ready: ${ready.reason}`);
    }
  });

  it("put + get round-trip via S3 client", async () => {
    const key = `test/p1c/${Date.now()}-roundtrip.txt`;
    const body = Buffer.from("hello minio");

    const putResult = await storagePut(key, body, "text/plain");
    expect(putResult.key).toMatch(new RegExp(`^${key.replace(".txt", "")}_[a-f0-9]{8}\\.txt$`));

    const s3 = getS3Client();
    if (!s3) throw new Error("S3 client null after configured endpoint");
    const got = await s3.send(
      new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: putResult.key }),
    );
    const text = await got.Body!.transformToString();
    expect(text).toBe("hello minio");
  });
});
