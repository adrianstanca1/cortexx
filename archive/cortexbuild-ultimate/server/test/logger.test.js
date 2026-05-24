/**
 * Logger unit tests
 * Verifies structured JSON output without network or filesystem dependencies.
 */

const logger = require("../lib/logger");

describe("Logger", () => {
  let stdoutSpy;
  let stderrSpy;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("should write info to stdout as JSON", () => {
    logger.info("Server started", { port: 3001 });
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe("info");
    expect(entry.msg).toBe("Server started");
    expect(entry.port).toBe(3001);
    expect(entry.pid).toBe(process.pid);
    expect(typeof entry.time).toBe("number");
  });

  it("should write warn to stdout as JSON", () => {
    logger.warn("Deprecation warning", { feature: "oldApi" });
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe("warn");
    expect(entry.msg).toBe("Deprecation warning");
    expect(entry.feature).toBe("oldApi");
  });

  it("should write error to stderr as JSON", () => {
    logger.error("DB connection failed", { code: "ECONNREFUSED" });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(stderrSpy.mock.calls[0][0]);
    expect(entry.level).toBe("error");
    expect(entry.msg).toBe("DB connection failed");
    expect(entry.code).toBe("ECONNREFUSED");
  });

  it("should include hostname in every entry", () => {
    logger.info("ping");
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(typeof entry.hostname).toBe("string");
    expect(entry.hostname.length).toBeGreaterThan(0);
  });
});
