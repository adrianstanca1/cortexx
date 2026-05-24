import { describe, expect, it } from "vitest";
import { COOKIE_NAME, ONE_YEAR_MS, AXIOS_TIMEOUT_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG } from "@shared/const";

describe("shared constants", () => {
  it("has the expected cookie name", () => {
    expect(COOKIE_NAME).toBe("app_session_id");
  });

  it("defines ONE_YEAR_MS as ~365 days", () => {
    expect(ONE_YEAR_MS).toBe(1000 * 60 * 60 * 24 * 365);
  });

  it("defines AXIOS_TIMEOUT_MS as 30 seconds", () => {
    expect(AXIOS_TIMEOUT_MS).toBe(30_000);
  });

  it("defines unauthenticated error message", () => {
    expect(UNAUTHED_ERR_MSG).toContain("10001");
  });

  it("defines permission error message", () => {
    expect(NOT_ADMIN_ERR_MSG).toContain("10002");
  });

  it("all constants are truthy", () => {
    expect(COOKIE_NAME).toBeTruthy();
    expect(UNAUTHED_ERR_MSG).toBeTruthy();
    expect(NOT_ADMIN_ERR_MSG).toBeTruthy();
  });
});
