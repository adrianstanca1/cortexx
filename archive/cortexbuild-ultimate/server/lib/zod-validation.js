const { z } = require("zod");

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatZodError(error) {
  const issues = error.issues.map((i) => i.message).join("; ");
  return issues;
}

function safeParse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { valid: false, error: formatZodError(result.error) };
  }
  return { valid: true, data: result.data };
}

// ─── Auth Schemas ─────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)",
    ),
  company: z.string().min(1, "Company name is required"),
  phone: z.string().optional().or(z.literal(null)),
});

const passwordResetSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

const twoFactorVerifySchema = z.object({
  code: z.string().min(1, "TOTP code is required"),
});

const twoFactorDisableSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string().min(1, "TOTP code is required"),
});

const twoFactorValidateSchema = z.object({
  tempToken: z.string().min(1, "tempToken is required"),
  code: z.string().min(1, "TOTP code is required"),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().optional().or(z.literal(null)),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/,
      "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)",
    ),
});

const avatarSchema = z.object({
  avatar: z.string().url("Avatar must be a valid URL").refine((val) => val.startsWith("https://"), {
    message: "Avatar must be a valid https:// URL",
  }),
});

const settingSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.any(),
});

const inviteSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  role: z.string().optional(),
});

const inviteAcceptSchema = z.object({
  token: z.string().min(1, "Token is required"),
  name: z.string().min(1, "Name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)",
    ),
});

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)",
    ),
  role: z.string().optional(),
  phone: z.string().optional().or(z.literal(null)),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// ─── Company Schemas ────────────────────────────────────────────────────────

const companyUpdateSchema = z.object({
  name: z.string().min(1).optional().or(z.literal(null)),
  registered_address: z.string().optional().or(z.literal(null)),
  city: z.string().optional().or(z.literal(null)),
  country: z.string().optional().or(z.literal(null)),
  postal_code: z.string().optional().or(z.literal(null)),
  phone: z.string().optional().or(z.literal(null)),
  email: z.string().email("Invalid email").optional().or(z.literal(null)),
  website: z.string().url("Invalid website URL").optional().or(z.literal(null)),
  companies_house_number: z.string().optional().or(z.literal(null)),
  vat_number: z.string().optional().or(z.literal(null)),
  utr_number: z.string().optional().or(z.literal(null)),
  hmrc_office: z.string().optional().or(z.literal(null)),
  cis_contractor: z.boolean().optional().or(z.literal(null)),
  cis_subcontractor: z.boolean().optional().or(z.literal(null)),
  logo_url: z.string().url("Invalid logo URL").optional().or(z.literal(null)),
  insurance_expiry: z.string().optional().or(z.literal(null)),
  tax_reference: z.string().optional().or(z.literal(null)),
});

const companyCreateUserSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional().or(z.literal(null)),
  password: z.string().optional(),
});

const companyUpdateUserSchema = z.object({
  role: z.string().optional(),
  phone: z.string().optional().or(z.literal(null)),
  is_active: z.boolean().optional(),
});

// ─── Generic CRUD Schemas ─────────────────────────────────────────────────

// Re-export ALLOWED_COLUMNS keys can be validated at runtime
function buildTableNameSchema(allowedTables) {
  return z.string().refine((val) => allowedTables.includes(val), {
    message: "Invalid table name",
  });
}

/**
 * Build a dynamic Zod schema for INSERT/UPDATE payloads.
 * Validates that keys are in the allowed list and values are primitive-safe.
 * Unknown keys are stripped (safe default); normalization like aiScore → ai_score
 * should happen before calling this schema.
 */
function buildCrudPayloadSchema(allowedColumns) {
  const shape = {};
  for (const col of allowedColumns) {
    shape[col] = z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.any()),
        z.record(z.any()),
      ])
      .optional();
  }
  return z.object(shape);
}

module.exports = {
  safeParse,
  formatZodError,
  loginSchema,
  registerSchema,
  passwordResetSchema,
  twoFactorVerifySchema,
  twoFactorDisableSchema,
  twoFactorValidateSchema,
  updateProfileSchema,
  updatePasswordSchema,
  avatarSchema,
  settingSchema,
  inviteSchema,
  inviteAcceptSchema,
  createUserSchema,
  companyUpdateSchema,
  companyCreateUserSchema,
  companyUpdateUserSchema,
  buildTableNameSchema,
  buildCrudPayloadSchema,
};
