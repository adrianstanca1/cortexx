/**
 * Zod validation schema tests
 * Verifies schema contracts are compatible with Zod v4.
 * Pure unit tests — no DB or network required.
 */

const {
  safeParse,
  loginSchema,
  registerSchema,
  buildCrudPayloadSchema,
} = require("../lib/zod-validation");

describe("Zod Validation", () => {
  describe("loginSchema", () => {
    it("should accept valid credentials", () => {
      const result = safeParse(loginSchema, {
        email: "adrian@example.com",
        password: "secret123",
      });
      expect(result.valid).toBe(true);
      expect(result.data.email).toBe("adrian@example.com");
    });

    it("should reject invalid email", () => {
      const result = safeParse(loginSchema, {
        email: "not-an-email",
        password: "secret123",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid email address");
    });

    it("should reject empty password", () => {
      const result = safeParse(loginSchema, {
        email: "adrian@example.com",
        password: "",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Password is required");
    });
  });

  describe("registerSchema", () => {
    it("should accept valid registration", () => {
      const result = safeParse(registerSchema, {
        name: "Adrian",
        email: "adrian@example.com",
        password: "Strong1!pass",
        company: "CortexBuild",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject weak password", () => {
      const result = safeParse(registerSchema, {
        name: "Adrian",
        email: "adrian@example.com",
        password: "weak",
        company: "CortexBuild",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("buildCrudPayloadSchema", () => {
    it("should accept allowed columns", () => {
      const schema = buildCrudPayloadSchema(["name", "status", "count"]);
      const result = safeParse(schema, {
        name: "Test",
        status: "active",
        count: 42,
      });
      expect(result.valid).toBe(true);
    });

    it("should ignore unknown keys (safe default)", () => {
      const schema = buildCrudPayloadSchema(["name"]);
      const result = safeParse(schema, {
        name: "Test",
        evil: "injection",
      });
      expect(result.valid).toBe(true);
      expect(result.data.evil).toBeUndefined();
    });
  });
});
